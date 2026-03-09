FROM apache/jmeter:5.6.3

# Install additional tools
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Set working directory
WORKDIR /tests

# Copy test files
COPY croc-shop-load-test.jmx .
COPY run-jmeter-test.sh .
COPY README.md .

# Make script executable
RUN chmod +x run-jmeter-test.sh

# Create results directory
RUN mkdir -p results

# Set environment variables
ENV JMETER_HOME=/opt/apache-jmeter-5.6.3
ENV PATH=$JMETER_HOME/bin:$PATH

# Default command
CMD ["./run-jmeter-test.sh"]
