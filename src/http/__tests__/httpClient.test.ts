/**
 * Copyright 2025-present Coinbase Global, Inc.
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

// A fake axios instance that records interceptors and runs them on request(),
// so we can assert exactly how many times each transformer executes.
interface FakeAxios {
  defaults: { headers: Record<string, unknown> };
  interceptors: {
    request: { use: (fn: (config: unknown) => unknown) => void };
    response: { use: (fn: (response: unknown) => unknown) => void };
  };
  request: (config: unknown) => Promise<unknown>;
}

const createdClients: FakeAxios[] = [];

function createFakeAxios(): FakeAxios {
  const requestInterceptors: Array<(config: unknown) => unknown> = [];
  const responseInterceptors: Array<(response: unknown) => unknown> = [];

  return {
    defaults: { headers: {} },
    interceptors: {
      request: {
        use: (fn) => {
          requestInterceptors.push(fn);
        },
      },
      response: {
        use: (fn) => {
          responseInterceptors.push(fn);
        },
      },
    },
    request: async (config: unknown) => {
      let cfg = config;
      for (const fn of requestInterceptors) {
        cfg = await fn(cfg);
      }
      let response: unknown = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: cfg,
      };
      for (const fn of responseInterceptors) {
        response = await fn(response);
      }
      return response;
    },
  };
}

jest.mock('axios', () => {
  // Keep the real module (notably AxiosHeaders, used by CoinbaseHttpRequest)
  // and only swap out client creation so no real HTTP calls are made.
  const actual = jest.requireActual('axios');
  const create = jest.fn(() => {
    const client = createFakeAxios();
    createdClients.push(client);
    return client;
  });
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, create, isAxiosError: () => false },
    create,
    isAxiosError: () => false,
  };
});

jest.mock('axios-retry', () => ({
  __esModule: true,
  default: jest.fn(),
  linearDelay: jest.fn(),
  exponentialDelay: jest.fn(),
}));

import axios from 'axios';
import https from 'https';
import { CoinbaseHttpClient } from '../httpClient';
import { CoinbaseHttpClientRetryOptions } from '../options';

const BASE_URL = 'https://api.example.com/v1/';

function baseOptions(
  overrides: Partial<CoinbaseHttpClientRetryOptions> = {}
): CoinbaseHttpClientRetryOptions {
  return {
    defaultLimit: 25,
    maxPages: 10,
    maxItems: 100,
    ...overrides,
  };
}

describe('CoinbaseHttpClient transformer registration', () => {
  beforeEach(() => {
    createdClients.length = 0;
    jest.clearAllMocks();
  });

  it('runs a per-call transformRequest exactly once', async () => {
    const client = new CoinbaseHttpClient(BASE_URL, 'test-agent');
    const callTransform = jest.fn((config) => config);

    await client.sendRequest({
      url: 'ping',
      callOptions: { transformRequest: callTransform },
    });

    expect(callTransform).toHaveBeenCalledTimes(1);
  });

  it('runs a global transformRequest exactly once per request', async () => {
    const globalTransform = jest.fn((config) => config);
    const client = new CoinbaseHttpClient(
      BASE_URL,
      'test-agent',
      undefined,
      baseOptions({ transformRequest: globalTransform })
    );
    const callTransform = jest.fn((config) => config);

    await client.sendRequest({
      url: 'ping',
      callOptions: { transformRequest: callTransform },
    });

    expect(globalTransform).toHaveBeenCalledTimes(1);
    expect(callTransform).toHaveBeenCalledTimes(1);
  });

  it('does not leak per-call transformers into subsequent requests', async () => {
    const globalTransform = jest.fn((config) => config);
    const client = new CoinbaseHttpClient(
      BASE_URL,
      'test-agent',
      undefined,
      baseOptions({ transformRequest: globalTransform })
    );

    const firstCallTransform = jest.fn((config) => config);
    await client.sendRequest({
      url: 'first',
      callOptions: { transformRequest: firstCallTransform },
    });

    const secondCallTransform = jest.fn((config) => config);
    await client.sendRequest({
      url: 'second',
      callOptions: { transformRequest: secondCallTransform },
    });

    // The first call's transformer must not run again on the second request.
    expect(firstCallTransform).toHaveBeenCalledTimes(1);
    expect(secondCallTransform).toHaveBeenCalledTimes(1);
    // Global transformer runs once per request (two requests total).
    expect(globalTransform).toHaveBeenCalledTimes(2);
  });

  it('runs a per-call transformResponse exactly once', async () => {
    const client = new CoinbaseHttpClient(BASE_URL, 'test-agent');
    const callTransform = jest.fn((response) => response);

    await client.sendRequest({
      url: 'ping',
      callOptions: { transformResponse: callTransform },
    });

    expect(callTransform).toHaveBeenCalledTimes(1);
  });

  it('applies transformers added via addTransformRequest exactly once and ignores duplicate registration', async () => {
    const client = new CoinbaseHttpClient(BASE_URL, 'test-agent');
    const added = jest.fn((config) => config);

    client.addTransformRequest(added);
    client.addTransformRequest(added); // duplicate reference should be ignored

    // No callOptions => uses the main client directly.
    await client.sendRequest({ url: 'ping' });

    expect(added).toHaveBeenCalledTimes(1);
  });

  it('replays addTransformRequest handlers onto per-call clients exactly once', async () => {
    const client = new CoinbaseHttpClient(BASE_URL, 'test-agent');
    const added = jest.fn((config) => config);
    client.addTransformRequest(added);

    await client.sendRequest({
      url: 'ping',
      callOptions: { timeout: 1000 },
    });

    expect(added).toHaveBeenCalledTimes(1);
  });
});

describe('CoinbaseHttpClient TLS configuration', () => {
  beforeEach(() => {
    createdClients.length = 0;
    jest.clearAllMocks();
  });

  it('passes a pre-built httpsAgent to axios.create', () => {
    const agent = new https.Agent();
    new CoinbaseHttpClient(
      BASE_URL,
      'test-agent',
      undefined,
      baseOptions({ httpsAgent: agent })
    );

    const create = jest.mocked(axios.create);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ httpsAgent: agent })
    );
  });

  it('builds an httpsAgent from tls options', () => {
    new CoinbaseHttpClient(
      BASE_URL,
      'test-agent',
      undefined,
      baseOptions({
        tls: {
          cert: 'cert-pem',
          key: 'key-pem',
        },
      })
    );

    const create = jest.mocked(axios.create);
    const config = create.mock.calls[create.mock.calls.length - 1]?.[0];
    expect(config?.httpsAgent).toBeInstanceOf(https.Agent);
  });

  it('prefers httpsAgent over tls when both are provided', () => {
    const agent = new https.Agent();
    new CoinbaseHttpClient(
      BASE_URL,
      'test-agent',
      undefined,
      baseOptions({
        httpsAgent: agent,
        tls: {
          cert: 'cert-pem',
          key: 'key-pem',
        },
      })
    );

    const create = jest.mocked(axios.create);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ httpsAgent: agent })
    );
  });

  it('does not set httpsAgent when no TLS options are provided', () => {
    new CoinbaseHttpClient(BASE_URL, 'test-agent');

    const create = jest.mocked(axios.create);
    const config = create.mock.calls[create.mock.calls.length - 1]?.[0];
    expect(config?.httpsAgent).toBeUndefined();
  });
});
