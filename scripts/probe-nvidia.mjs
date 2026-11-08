const key = process.env.NVIDIA_API_KEY;
if (!key) throw new Error('NVIDIA_API_KEY is missing.');
const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-bolt-e4b';
if (process.argv.includes('--list')) {
  const r = await fetch('https://integrate.api.nvidia.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Models HTTP ${r.status}`);
  console.log((await r.json()).data.filter(x => x.id.includes('nemotron')).map(x => x.id).join('\n'));
  process.exit(0);
}
const messages = [{ role: 'user', content: 'Call get_learner_profile, then describe the weakest skill in one sentence using the returned data.' }];
const tools = [{ type: 'function', function: { name: 'get_learner_profile', description: 'Read synthetic training scores.', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } } }];
async function call(extra) {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 1, top_p: 0.95, chat_template_kwargs: { enable_thinking: false }, ...extra }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`NVIDIA HTTP ${response.status}: ${String(error.error?.message || error.detail || 'Request failed').replaceAll(key, '[redacted]').slice(0,400)}`);
  }
  return (await response.json()).choices?.[0]?.message;
}
const first = await call({ tools, tool_choice: { type: 'function', function: { name: 'get_learner_profile' } } });
const tool = first?.tool_calls?.[0];
if (tool?.function?.name !== 'get_learner_profile') {
  console.log({ responseFields: Object.keys(first || {}), content: first?.content, toolCalls: first?.tool_calls });
  throw new Error('Model did not return the required tool call.');
}
messages.push(first, { role: 'tool', tool_call_id: tool.id, content: JSON.stringify({ authority: 50, urgency: 50, verification: 40 }) });
const second = await call({ tools, tool_choice: 'none' });
if (!second?.content) throw new Error('No final response.');
console.log(JSON.stringify({ model, authenticated: true, toolCycle: true, feedback: second.content }));
