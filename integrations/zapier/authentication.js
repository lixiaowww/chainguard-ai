const testAuth = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.base_url}/api/health`,
    headers: {
      'X-ChainGuard-Api-Key': bundle.authData.api_key,
    },
  });
  return response.data;
};

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'base_url',
      label: 'ChainGuard API Base URL',
      required: true,
      type: 'string',
      helpText: 'Your ChainGuard deployment URL, e.g. https://yourname-chainguard-ai.hf.space',
    },
    {
      key: 'api_key',
      label: 'API Key',
      required: true,
      type: 'password',
      helpText: 'Set CHAINGUARD_API_KEY on your server and paste the same value here.',
    },
  ],
  test: testAuth,
  connectionLabel: '{{base_url}}',
};
