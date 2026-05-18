import dotenv from 'dotenv';
import express from 'express';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3010),
  MCP_SERVER_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  SYSTEM_PROMPT: z.string().default('You are a helpful assistant for the Croc Shop demo. Use MCP tools when they help answer the user accurately.'),
});

const config = envSchema.parse(process.env);

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

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content;
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

function toAnthropicTool(tool) {
  return {
    name: tool.name,
    description: tool.description ?? '',
    input_schema: tool.inputSchema ?? {
      type: 'object',
      properties: {},
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

async function callAnthropic(payload) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  return response.json();
}

function extractText(content) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

async function runClaudeToolLoop({ messages, system, model, maxTokens }) {
  await ensureMcpConnection();

  if (!cachedTools.length) {
    await refreshTools();
  }

  const anthropicMessages = messages.map((message) => ({
    role: message.role,
    content: normalizeMessageContent(message.content),
  }));

  const executedTools = [];

  for (let i = 0; i < 8; i += 1) {
    const response = await callAnthropic({
      model: model ?? config.ANTHROPIC_MODEL,
      max_tokens: maxTokens ?? config.ANTHROPIC_MAX_TOKENS,
      system: system ?? config.SYSTEM_PROMPT,
      messages: anthropicMessages,
      tools: cachedTools.map(toAnthropicTool),
    });

    anthropicMessages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolUses = response.content.filter((block) => block.type === 'tool_use');
    if (!toolUses.length) {
      return {
        model: response.model,
        stopReason: response.stop_reason,
        text: extractText(response.content),
        content: response.content,
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
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input ?? {},
        isError: Boolean(toolResult.isError),
        result: serialized,
      });

      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: serialized,
        is_error: Boolean(toolResult.isError),
      });
    }

    anthropicMessages.push({
      role: 'user',
      content: toolResultContent,
    });
  }

  throw new Error('Claude tool loop exceeded the maximum number of tool turns.');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  res.json({ status: 'healthy', service: 'croc-shop-mcp-client' });
});

app.get('/ready', async (req, res) => {
  try {
    await refreshTools();
    res.json({ status: 'ready', service: 'croc-shop-mcp-client', toolCount: cachedTools.length });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/tools', async (req, res, next) => {
  try {
    const tools = await refreshTools();
    res.json({ tools });
  } catch (error) {
    next(error);
  }
});

app.post('/chat', async (req, res, next) => {
  try {
    const payload = chatRequestSchema.parse(req.body);
    const result = await runClaudeToolLoop(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

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
