# HTTPS Over Proxy Node for n8n

> [繁體中文版說明文件](README.zh-TW.md)

This node allows you to make HTTPS requests through an HTTP proxy in n8n workflows.

## Features

- Make HTTPS requests through HTTP proxies
- Support for proxy authentication
- Configurable timeout settings
- Option to ignore SSL certificate validation issues
- Support for various request methods (GET, POST, PUT, DELETE, etc.)
- Support for query parameters, headers, and body data
- Batch processing capabilities
- Pagination support
- Internal network access control for security

## Installation

### Local Installation

1. Go to your n8n installation directory
2. Install the node package:
```bash
npm install n8n-nodes-httpsoverproxy
```

### Global Installation

If you installed n8n globally, you can install this node globally too:

```bash
npm install -g n8n-nodes-httpsoverproxy
```

## Usage

After installation, you can find the "HTTPS Over Proxy" node in the n8n nodes panel under the "Network" category.

### Basic Configuration

1. Add the HTTPS Over Proxy node to your workflow
2. Set the request method (GET, POST, etc.)
3. Enter the target URL
4. Configure proxy settings in the Options section:
   - Enable "Use Proxy"
   - Enter Proxy Host (without http:// or https:// prefix)
   - Enter Proxy Port
   - Configure proxy authentication if needed

### Advanced Options

- **Allow Internal Network Access**: Enable to allow requests to internal network addresses (disabled by default for security)

## Security Features

- Protection against SSRF attacks
- Restricted internal network access (localhost, 127.0.0.1, etc.) by default
- Secure proxy authentication handling


## License

[MIT](LICENSE)
