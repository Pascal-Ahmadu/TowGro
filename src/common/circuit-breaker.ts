import {
    handleAll,
    retry,
    circuitBreaker,
    wrap,
    ExponentialBackoff,
    ConsecutiveBreaker,
  } from 'cockatiel';
  
  const retryPolicy = retry(handleAll, {
    maxAttempts: 3,
    backoff: new ExponentialBackoff(),
  });
  
  const breakerPolicy = circuitBreaker(handleAll, {
    breaker: new ConsecutiveBreaker(5),
    halfOpenAfter: 10_000,
  });
  
  export const resilientPolicy = wrap(retryPolicy, breakerPolicy);
  