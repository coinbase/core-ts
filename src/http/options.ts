export enum Method {
  GET = 'GET',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

/**
 * A function to modify a request config before sending
 */
export type TransformRequestFn = (config: any) => any;

/**
 * A function modify a response object before returning
 */
export type TransformResponseFn = (data: any) => any;

/**
 * TLS material accepted for mutual TLS client authentication.
 */
export type CoinbaseTlsMaterial = string | Buffer | Array<string | Buffer>;

/**
 * Options for configuring mutual TLS (mTLS) client certificates.
 */
export interface CoinbaseTlsOptions {
  /**
   * Client certificate (PEM string or Buffer).
   */
  cert?: CoinbaseTlsMaterial;
  /**
   * Client private key (PEM string or Buffer).
   */
  key?: CoinbaseTlsMaterial;
  /**
   * Certificate authority bundle used to verify the server certificate.
   */
  ca?: CoinbaseTlsMaterial;
  /**
   * Passphrase for an encrypted private key or PFX bundle.
   */
  passphrase?: string;
  /**
   * PKCS#12 archive containing certificate and key.
   */
  pfx?: string | Buffer | Array<string | Buffer>;
  /**
   * Whether to reject invalid or unauthorized server certificates.
   * Defaults to Node.js / axios secure behavior when omitted.
   */
  rejectUnauthorized?: boolean;
}

export interface CoinbaseHttpClientRetryOptions {
  /**
   * A number of milliseconds to wait before timing out
   */
  timeout?: number;
  /**
   * A default limit when calling a paginated endpoint
   */
  defaultLimit: number;
  /**
   * A max number of pages to fetch when paginating
   */
  maxPages: number;
  /**
   * A max number of items to fetch when paginating
   */
  maxItems: number;
  /**
   * A number of times to retry
   */
  retries?: number;
  /**
   * A linear number to increase the delay between retries
   */
  retryDelay?: number;
  /**
   * A boolean to enable exponential backoff for retries
   */
  retryExponential?: boolean;
  /**
   * A function to to calculate the delay between retries
   */
  retryCustomFunction?: (retryCount: number) => number;
  /**
   * A function to modify the request object and/or headers
   */
  transformRequest?: TransformRequestFn | TransformRequestFn[];
  /**
   * A function to modify the response object before returning
   */
  transformResponse?: TransformResponseFn | TransformResponseFn[];
  /**
   * A pre-built Node.js https.Agent for TLS configuration (including mTLS).
   * Takes precedence over `tls` when both are provided.
   */
  httpsAgent?: import('https').Agent;
  /**
   * TLS options used to build an https.Agent for mutual TLS.
   */
  tls?: CoinbaseTlsOptions;
}

export interface CoinbaseHttpRequestOptions {
  /**
   * URL Path
   */
  url?: string;
  /**
   * HTTP Method, prefer enum Method
   */
  method?: string | undefined;
  /**
   * Query Parameters
   */
  queryParams?: Record<string, any>;
  /**
   * Request Body
   */
  bodyParams?: Record<string, any>;
  callOptions?: CoinbaseCallOptions;
}

export interface CoinbaseResponse<T = any> {
  data: T;
  /**
   * HTTP status code
   */
  status: number;
  /**
   * HTTP status message
   */
  statusText: string;
  /**
   * HTTP headers
   */
  headers: Record<string, string>;
}

export interface HttpClient {
  sendRequest(options: CoinbaseHttpRequestOptions): Promise<CoinbaseResponse>;
  addHeader(key: string, value: string): void;
  addTransformRequest(func: TransformRequestFn): void;
  addTransformResponse(func: TransformResponseFn): void;
  getDefaultPaginationLimit(): number;
  getMaxPages(): number;
  getMaxItems(): number;
}

export interface CoinbaseCallOptions {
  /**
   * A signal to cancel the request
   */
  signal?: AbortSignal;
  /**
   * A number of milliseconds to wait before timing out
   */
  timeout?: number;
  /**
   * A max number of pages to fetch when paginating
   */
  maxPages?: number;
  /**
   * A number of max items to fetch when paginating
   */
  maxItems?: number;
  /**
   * A number of times to retry
   */
  retries?: number;
  /**
   * A linear number to increase the delay between retries
   */
  retryDelay?: number;
  /**
   * A boolean to enable exponential backoff for retries
   */
  retryExponential?: boolean;
  /**
   * A function to to calculate the delay between retries
   */
  retryCustomFunction?: (retryCount: number) => number;
  /**
   * A function to modify the request object and/or headers
   */
  transformRequest?: TransformRequestFn | TransformRequestFn[];
  /**
   * A function to modify the response object before returning
   */
  transformResponse?: TransformResponseFn | TransformResponseFn[];
  /**
   * A pre-built Node.js https.Agent for TLS configuration (including mTLS).
   * Takes precedence over `tls` when both are provided.
   */
  httpsAgent?: import('https').Agent;
  /**
   * TLS options used to build an https.Agent for mutual TLS.
   */
  tls?: CoinbaseTlsOptions;
}
