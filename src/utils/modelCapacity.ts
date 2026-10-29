/** 只消费服务端声明的容量字段，不从模型名称、价格或请求默认 max_tokens 猜测。 */
export function declaredModelCapacity(model: Record<string, any>) {
  const positive = (...values: unknown[]) => values.map(value => typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() ? Number(value) : NaN).find(value => Number.isSafeInteger(value) && value > 0)
  return {
    contextWindow: positive(model.contextWindow, model.context_window, model.context_length, model.top_provider?.context_length, model.meta?.n_ctx),
    maxOutputTokens: positive(model.maxOutputTokens, model.max_output_tokens, model.max_completion_tokens, model.top_provider?.max_completion_tokens),
  }
}
