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

- **Timeout**: Increase this value if your proxy or target website is slow
- **Allow Unauthorized Certificates**: Enable to ignore SSL certificate validation issues
- **Batching**: Configure batch size and interval for processing multiple requests
- **Allow Internal Network Access**: Enable to allow requests to internal network addresses (disabled by default for security)
- **Full Response**: Return complete response data including headers and status code
- **Response Format**: Choose between autodetect, JSON, text, or file

## Security Features

- Protection against SSRF attacks
- Restricted internal network access (localhost, 127.0.0.1, etc.) by default
- Secure proxy authentication handling

## Examples

### Basic GET Request Through Proxy

```json
{
  "parameters": {
    "method": "GET",
    "url": "https://example.com",
    "options": {
      "proxy": {
        "settings": {
          "useProxy": true,
          "proxyHost": "proxy.example.com",
          "proxyPort": 8080
        }
      }
    }
  }
}
```

### POST Request with Authentication

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/data",
    "sendBody": true,
    "contentType": "json",
    "bodyParameters": {
      "parameters": [
        {
          "name": "username",
          "value": "user123"
        },
        {
          "name": "action",
          "value": "login"
        }
      ]
    },
    "options": {
      "proxy": {
        "settings": {
          "useProxy": true,
          "proxyHost": "proxy.example.com",
          "proxyPort": 8080,
          "proxyAuth": true,
          "proxyUsername": "proxyuser",
          "proxyPassword": "proxypass"
        }
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Verify that the proxy server is running and the port is correct
2. **Timeout Errors**: Increase the timeout value in the options
3. **SSL Certificate Errors**: Enable "Allow Unauthorized Certificates" if you trust the target site
4. **Proxy Format Errors**: Make sure not to include http:// or https:// in the proxy host field

## License

[MIT](LICENSE)
