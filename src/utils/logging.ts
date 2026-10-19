/** Request logs omit query values, credentials and bodies, including rejected legacy URLs. */
export const loggerOptions = {
  level: 'info',
  redact: ['req.headers["admin-secret-key"]', 'req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    req(request: { id?: string; method?: string; url?: string }) {
      return { id: request.id, method: request.method, url: request.url?.split('?')[0] };
    },
  },
};
