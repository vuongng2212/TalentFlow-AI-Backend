const fs = require('fs');
const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));

const endpoints = [
  { path: '/api/v1/auth/signup', methods: ['post'] },
  { path: '/api/v1/auth/login', methods: ['post'] },
  { path: '/api/v1/auth/refresh', methods: ['post'] },
  { path: '/api/v1/auth/me', methods: ['get'] },
  { path: '/api/v1/auth/logout', methods: ['post'] },
  { path: '/api/v1/users', methods: ['get'] },
  { path: '/api/v1/users/active-workspace', methods: ['patch'] },
  { path: '/api/v1/users/{id}', methods: ['get', 'patch', 'delete'] },
  { path: '/api/v1/users/{id}/role', methods: ['patch'] },
  { path: '/api/v1/jobs', methods: ['post', 'get'] },
  { path: '/api/v1/jobs/{id}', methods: ['get', 'patch', 'delete', 'put'] },
  { path: '/api/v1/applications', methods: ['post', 'get'] },
  { path: '/api/v1/applications/upload', methods: ['post'] },
  { path: '/api/v1/applications/{id}', methods: ['get', 'patch', 'delete', 'put'] },
  { path: '/api/v1/candidates', methods: ['get'] },
  { path: '/api/v1/candidates/{id}', methods: ['get', 'patch', 'delete'] },
  { path: '/api/v1/analytics/overview', methods: ['get'] },
  { path: '/api/v1/analytics/pipeline', methods: ['get'] },
  { path: '/api/v1/analytics/trends', methods: ['get'] },
  { path: '/api/v1/analytics/top-jobs', methods: ['get'] },
  { path: '/api/v1/interviews', methods: ['post', 'get'] },
  { path: '/api/v1/interviews/{id}', methods: ['get', 'patch', 'delete'] },
  { path: '/api/v1/workspaces', methods: ['post'] },
  { path: '/api/v1/workspaces/{id}/members', methods: ['post', 'get'] },
  { path: '/api/v1/workspaces/{id}/invitations', methods: ['post'] },
  { path: '/api/v1/workspaces/invitations/accept', methods: ['post'] },
  { path: '/api/v1/email-templates', methods: ['post', 'get'] },
  { path: '/api/v1/email-templates/{id}', methods: ['get', 'patch', 'delete'] }
];

function resolveRef(ref) {
  if (!ref) return null;
  const parts = ref.split('/');
  let current = swagger;
  for (let i = 1; i < parts.length; i++) {
    current = current[parts[i]];
  }
  return current;
}

function processSchema(schema, depth = 0) {
  if (!schema) return 'any';
  if (depth > 5) return '...'; // Prevent infinite recursion
  
  if (schema.$ref) {
    return processSchema(resolveRef(schema.$ref), depth + 1);
  }
  
  if (schema.type === 'object' && schema.properties) {
    const props = {};
    for (const [key, val] of Object.entries(schema.properties)) {
      props[key] = processSchema(val, depth + 1);
    }
    return props;
  }
  
  if (schema.type === 'array' && schema.items) {
    return [processSchema(schema.items, depth + 1)];
  }
  
  if (schema.type) {
    return schema.type;
  }
  
  return schema;
}

let md = '# API Documentation\n\n';

for (const endpoint of endpoints) {
  const pathData = swagger.paths[endpoint.path];
  if (!pathData) {
    md += `## \`${endpoint.path}\` - NOT FOUND IN SWAGGER\n\n`;
    continue;
  }
  
  for (const method of endpoint.methods) {
    const op = pathData[method];
    if (!op) continue;
    
    md += `## ${method.toUpperCase()} ${endpoint.path}\n\n`;
    if (op.summary) md += `**Summary**: ${op.summary}\n\n`;
    
    // Headers
    let headers = ['Authorization: Bearer <token>'];
    if (op.parameters) {
      for (const param of op.parameters) {
        if (param.in === 'header') {
          headers.push(`${param.name}: ${param.schema?.type || 'string'}`);
        }
      }
    }
    md += `**Headers**:\n\`\`\`\n${headers.join('\n')}\n\`\`\`\n\n`;
    
    // Request Payload
    if (op.requestBody) {
      let bodySchema = op.requestBody.content?.['application/json']?.schema || op.requestBody.content?.['multipart/form-data']?.schema;
      if (bodySchema) {
        md += `**Request Payload**:\n\`\`\`json\n${JSON.stringify(processSchema(bodySchema), null, 2)}\n\`\`\`\n\n`;
      }
    }
    
    // Response
    if (op.responses) {
      const okResponse = op.responses['200'] || op.responses['201'];
      if (okResponse) {
        let resSchema = okResponse.content?.['application/json']?.schema;
        if (resSchema) {
          md += `**Response (Success)**:\n\`\`\`json\n${JSON.stringify(processSchema(resSchema), null, 2)}\n\`\`\`\n\n`;
        } else {
          md += `**Response (Success)**: OK\n\n`;
        }
      }
    }
    md += '---\n\n';
  }
}

fs.writeFileSync('api_docs.md', md);
console.log('Done');
