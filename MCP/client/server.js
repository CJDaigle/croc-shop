import dotenv from 'dotenv';
import express from 'express';
import promClient from 'prom-client';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3010),
  MCP_SERVER_URL: z.string().url(),
  CLIENT_API_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().min(1).default('us.anthropic.claude-sonnet-4-20250514-v1:0'),
  BEDROCK_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),
  SYSTEM_PROMPT: z.string().default('You are a helpful assistant for the Croc Shop demo. Use MCP tools when they help answer the user accurately.'),
});

const config = envSchema.parse(process.env);
const bedrockClient = new BedrockRuntimeClient({ region: config.AWS_REGION });
const registry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([
    z.string(),
    z.array(z.object({ type: z.string() }).passthrough()),
  ]),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  system: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

let mcpClient;
let mcpTransport;
let cachedTools = [];
let connectingPromise;
const rateLimitBuckets = new Map();

function withHttpMetrics(routeLabel, handler) {
  return async (req, res, next) => {
    const end = httpRequestDuration.startTimer();

    res.on('finish', () => {
      const statusCode = String(res.statusCode);
      httpRequestsTotal.inc({ method: req.method, route: routeLabel, status_code: statusCode });
      end({ method: req.method, route: routeLabel, status_code: statusCode });
    });

    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function getClientIdentifier(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || 'unknown';
}

function requireClientApiKey(req, res, next) {
  const providedApiKey = req.header('x-api-key');

  if (!providedApiKey || providedApiKey !== config.CLIENT_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

function rateLimit(req, res, next) {
  const identifier = getClientIdentifier(req);
  const now = Date.now();
  const existing = rateLimitBuckets.get(identifier);

  if (!existing || now >= existing.resetAt) {
    rateLimitBuckets.set(identifier, {
      count: 1,
      resetAt: now + config.RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  if (existing.count >= config.RATE_LIMIT_MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((existing.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  existing.count += 1;
  next();
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  return content.map((block) => {
    if (block.type === 'text' && typeof block.text === 'string') {
      return { text: block.text };
    }

    if (block.type === 'tool_use') {
      return {
        toolUse: {
          toolUseId: block.id,
          name: block.name,
          input: block.input ?? {},
        },
      };
    }

    if (block.type === 'tool_result') {
      let parsedJson;
      if (typeof block.content === 'string') {
        try {
          parsedJson = JSON.parse(block.content);
        } catch (error) {
          parsedJson = undefined;
        }
      }

      return {
        toolResult: {
          toolUseId: block.tool_use_id,
          status: block.is_error ? 'error' : 'success',
          content: parsedJson !== undefined ? [{ json: parsedJson }] : [{ text: String(block.content ?? '') }],
        },
      };
    }

    return { text: JSON.stringify(block) };
  });
}

async function ensureMcpConnection() {
  if (mcpClient && mcpTransport) {
    return mcpClient;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    const client = new Client({
      name: 'croc-shop-mcp-client',
      version: '1.0.0',
    });

    client.onerror = (error) => {
      console.error('MCP client error:', error);
    };

    const transport = new StreamableHTTPClientTransport(new URL(config.MCP_SERVER_URL));
    await client.connect(transport);

    mcpClient = client;
    mcpTransport = transport;

    const toolsResult = await mcpClient.listTools();
    cachedTools = toolsResult.tools;

    return mcpClient;
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = undefined;
  }
}

async function refreshTools() {
  await ensureMcpConnection();
  const toolsResult = await mcpClient.listTools();
  cachedTools = toolsResult.tools;
  return cachedTools;
}

function toBedrockTool(tool) {
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: {
        json: tool.inputSchema ?? {
          type: 'object',
          properties: {},
        },
      },
    },
  };
}

function stringifyToolResult(result) {
  if (result.structuredContent) {
    return JSON.stringify(result.structuredContent, null, 2);
  }

  if (result.content?.length) {
    return result.content
      .map((item) => {
        if (typeof item?.text === 'string') {
          return item.text;
        }

        return JSON.stringify(item, null, 2);
      })
      .join('\n');
  }

  return JSON.stringify(result, null, 2);
}

function bedrockContentToPublicContent(content = []) {
  return content.flatMap((block) => {
    if (typeof block.text === 'string') {
      return [{ type: 'text', text: block.text }];
    }

    if (block.toolUse) {
      return [{
        type: 'tool_use',
        id: block.toolUse.toolUseId,
        name: block.toolUse.name,
        input: block.toolUse.input ?? {},
      }];
    }

    if (block.toolResult) {
      return [{
        type: 'tool_result',
        tool_use_id: block.toolResult.toolUseId,
        is_error: block.toolResult.status === 'error',
        content: JSON.stringify(block.toolResult.content ?? []),
      }];
    }

    return [];
  });
}

async function callBedrock({ system, messages, tools, modelId, maxTokens }) {
  try {
    return await bedrockClient.send(new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages,
      toolConfig: {
        tools,
      },
      inferenceConfig: {
        maxTokens,
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Bedrock error';
    throw new Error(`Bedrock API error: ${message}`);
  }
}

function extractText(content) {
  return content
    .filter((block) => typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

async function runClaudeToolLoop({ messages, system, model, maxTokens }) {
  await ensureMcpConnection();

  if (!cachedTools.length) {
    await refreshTools();
  }

  const bedrockMessages = messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));

  const executedTools = [];

  for (let i = 0; i < 8; i += 1) {
    const response = await callBedrock({
      modelId: model ?? config.BEDROCK_MODEL_ID,
      maxTokens: maxTokens ?? config.BEDROCK_MAX_TOKENS,
      system: system ?? config.SYSTEM_PROMPT,
      messages: bedrockMessages,
      tools: cachedTools.map(toBedrockTool),
    });

    const responseContent = response.output?.message?.content ?? [];

    bedrockMessages.push({
      role: 'assistant',
      content: responseContent,
    });

    const toolUses = responseContent
      .filter((block) => block.toolUse)
      .map((block) => block.toolUse);

    if (!toolUses.length) {
      return {
        model: response.modelId ?? (model ?? config.BEDROCK_MODEL_ID),
        stopReason: response.stopReason,
        text: extractText(responseContent),
        content: bedrockContentToPublicContent(responseContent),
        toolResults: executedTools,
      };
    }

    const toolResultContent = [];

    for (const toolUse of toolUses) {
      const toolResult = await mcpClient.callTool({
        name: toolUse.name,
        arguments: toolUse.input ?? {},
      });

      const serialized = stringifyToolResult(toolResult);

      executedTools.push({
        id: toolUse.toolUseId,
        name: toolUse.name,
        input: toolUse.input ?? {},
        isError: Boolean(toolResult.isError),
        result: serialized,
      });

      let parsedJson;
      try {
        parsedJson = JSON.parse(serialized);
      } catch (error) {
        parsedJson = undefined;
      }

      toolResultContent.push({
        toolResult: {
          toolUseId: toolUse.toolUseId,
          status: toolResult.isError ? 'error' : 'success',
          content: parsedJson !== undefined ? [{ json: parsedJson }] : [{ text: serialized }],
        },
      });
    }

    bedrockMessages.push({
      role: 'user',
      content: toolResultContent,
    });
  }

  throw new Error('Claude tool loop exceeded the maximum number of tool turns.');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', withHttpMetrics('/health', async (req, res) => {
  res.json({ status: 'healthy', service: 'croc-shop-mcp-client' });
}));

app.get('/ready', withHttpMetrics('/ready', async (req, res) => {
  try {
    await refreshTools();
    res.json({ status: 'ready', service: 'croc-shop-mcp-client', toolCount: cachedTools.length });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

app.get('/metrics', withHttpMetrics('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}));

app.get('/tools', requireClientApiKey, rateLimit, withHttpMetrics('/tools', async (req, res, next) => {
  try {
    const tools = await refreshTools();
    res.json({ tools });
  } catch (error) {
    next(error);
  }
}));

app.post('/chat', requireClientApiKey, rateLimit, withHttpMetrics('/chat', async (req, res, next) => {
  try {
    const payload = chatRequestSchema.parse(req.body);
    const result = await runClaudeToolLoop(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
}));

app.use((error, req, res, next) => {
  console.error('Unhandled MCP client error:', error);

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    error: error instanceof Error ? error.message : 'Internal server error',
  });
});

app.listen(config.PORT, () => {
  console.log(`croc-shop-mcp-client listening on port ${config.PORT}`);
});
