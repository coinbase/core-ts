/**
 * Copyright 2024-present Coinbase Global, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { CoinbaseCredentials } from '../credentials';
import { CoinbaseHttpRequest } from './coinbaseHttpRequest';
import {
  CoinbaseHttpClientRetryOptions,
  CoinbaseHttpRequestOptions,
  CoinbaseResponse,
  HttpClient,
  Method,
  TransformRequestFn,
  TransformResponseFn,
} from './options';
import { handleException } from '../error';
import {
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_PAGINATION_MAX_ITEMS,
  DEFAULT_PAGINATION_MAX_PAGES,
} from '../constants';
import { buildHttpsAgent } from './tls';

export class CoinbaseHttpClient implements HttpClient {
  private credentials: CoinbaseCredentials | undefined;
  private httpClient: AxiosInstance;
  private apiBasePath: string;
  private userAgent: string;
  private httpOptions: CoinbaseHttpClientRetryOptions;
  private addedHeaders: Record<string, string> = {};
  private addedRequestTransformers: TransformRequestFn[] = [];
  private addedResponseTransformers: TransformResponseFn[] = [];

  constructor(
    apiBasePath: string,
    userAgent: string,
    credentials?: CoinbaseCredentials,
    options?: CoinbaseHttpClientRetryOptions
  ) {
    this.apiBasePath = apiBasePath;
    this.userAgent = userAgent;
    this.credentials = credentials;
    if (!options) {
      options = {
        defaultLimit: DEFAULT_PAGINATION_LIMIT,
        maxPages: DEFAULT_PAGINATION_MAX_PAGES,
        maxItems: DEFAULT_PAGINATION_MAX_ITEMS,
      };
    }
    if (!options.defaultLimit) options.defaultLimit = DEFAULT_PAGINATION_LIMIT;
    if (!options.maxPages) options.maxPages = DEFAULT_PAGINATION_MAX_PAGES;
    if (!options.maxItems) options.maxItems = DEFAULT_PAGINATION_MAX_ITEMS;
    this.httpOptions = options;
    this.addedRequestTransformers = this.toArray(options.transformRequest);
    this.addedResponseTransformers = this.toArray(options.transformResponse);
    this.httpClient = this._setupHttpClient(options);
    this.applyRequestTransformers(
      this.httpClient,
      this.addedRequestTransformers
    );
    this.applyResponseTransformers(
      this.httpClient,
      this.addedResponseTransformers
    );
  }

  // _setupHttpClient only builds the axios instance and retry behavior.
  // Transformer registration is handled separately so that ephemeral,
  // per-call clients never mutate the shared transformer lists.
  _setupHttpClient(options?: CoinbaseHttpClientRetryOptions) {
    const httpsAgent = buildHttpsAgent(options);
    const axiosClient = axios.create({
      baseURL: this.apiBasePath,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      ...(httpsAgent ? { httpsAgent } : {}),
    });

    if (options) {
      if (options.retries) {
        axiosRetry(axiosClient, { retries: options.retries });
      } else if (options.retryDelay) {
        axiosRetry(axiosClient, {
          retryDelay: axiosRetry.linearDelay(options.retryDelay),
        });
      } else if (options.retryExponential) {
        axiosRetry(axiosClient, {
          retryDelay: axiosRetry.exponentialDelay,
        });
      } else if (options.retryCustomFunction) {
        axiosRetry(axiosClient, {
          retryDelay: options.retryCustomFunction,
        });
      }
    }

    return axiosClient;
  }

  private toArray<T>(value?: T | T[]): T[] {
    if (!value) return [];
    return Array.isArray(value) ? [...value] : [value];
  }

  private applyRequestTransformers(
    client: AxiosInstance,
    transformers: TransformRequestFn[]
  ) {
    transformers.forEach((transformer) => {
      client.interceptors.request.use(transformer, null);
    });
  }

  private applyResponseTransformers(
    client: AxiosInstance,
    transformers: TransformResponseFn[]
  ) {
    transformers.forEach((transformer) => {
      client.interceptors.response.use(transformer, null);
    });
  }

  async sendRequest<T = any>(
    options: CoinbaseHttpRequestOptions
  ): Promise<CoinbaseResponse<T>> {
    const { url, queryParams, bodyParams } = options;
    const requestMethod = (options.method as Method) || Method.GET;

    const cbRequest = new CoinbaseHttpRequest(
      requestMethod,
      this.apiBasePath,
      url,
      this.credentials,
      queryParams,
      bodyParams,
      options.callOptions
    );

    let client = this.httpClient;

    if (options.callOptions) {
      const combinedOptions = {
        ...this.httpOptions,
        ...options.callOptions,
      };
      const callSpecificClient = this._setupHttpClient(combinedOptions);
      Object.entries(this.addedHeaders).forEach(([key, value]) => {
        callSpecificClient.defaults.headers[key] = value;
      });

      // Replay the persistent transformers (constructor globals + any added
      // via addTransform*) onto the per-call client, then apply the
      // call-specific transformers. Each runs exactly once and the
      // call-specific ones are never persisted, so nothing leaks across calls.
      this.applyRequestTransformers(
        callSpecificClient,
        this.addedRequestTransformers
      );
      this.applyResponseTransformers(
        callSpecificClient,
        this.addedResponseTransformers
      );
      this.applyRequestTransformers(
        callSpecificClient,
        this.toArray(options.callOptions.transformRequest)
      );
      this.applyResponseTransformers(
        callSpecificClient,
        this.toArray(options.callOptions.transformResponse)
      );

      client = callSpecificClient;
    }

    try {
      const response = await client.request(cbRequest);
      if (response?.headers && typeof response.headers.toJSON === 'function') {
        response.headers = response.headers.toJSON();
      }
      return response as CoinbaseResponse<T>;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        handleException(
          error?.response as CoinbaseResponse<T>,
          error.response?.data,
          error.message
        );
      }
      throw error;
    }
  }

  addHeader(key: string, value: string) {
    this.httpClient.defaults.headers[key] = value;
    this.addedHeaders[key] = value;
  }

  addTransformRequest(func: TransformRequestFn) {
    // Guard against registering the same handler twice.
    if (this.addedRequestTransformers.includes(func)) return;
    this.addedRequestTransformers.push(func);
    this.httpClient.interceptors.request.use(func, null);
  }

  addTransformResponse(func: TransformResponseFn) {
    // Guard against registering the same handler twice.
    if (this.addedResponseTransformers.includes(func)) return;
    this.addedResponseTransformers.push(func);
    this.httpClient.interceptors.response.use(func, null);
  }

  getDefaultPaginationLimit() {
    return this.httpOptions.defaultLimit;
  }

  getMaxPages() {
    return this.httpOptions.maxPages;
  }

  getMaxItems() {
    return this.httpOptions.maxItems;
  }
}
