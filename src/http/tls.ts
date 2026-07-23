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
import https from 'https';
import { CoinbaseTlsOptions } from './options';

type TlsSource = {
  httpsAgent?: https.Agent;
  tls?: CoinbaseTlsOptions;
};

function hasTlsMaterial(tls: CoinbaseTlsOptions): boolean {
  return (
    tls.cert !== undefined ||
    tls.key !== undefined ||
    tls.ca !== undefined ||
    tls.pfx !== undefined ||
    tls.passphrase !== undefined ||
    tls.rejectUnauthorized !== undefined
  );
}

/**
 * Returns an https.Agent for axios from explicit agent or TLS material.
 * `httpsAgent` takes precedence when both are provided.
 */
export function buildHttpsAgent(options?: TlsSource): https.Agent | undefined {
  if (!options) {
    return undefined;
  }

  if (options.httpsAgent) {
    return options.httpsAgent;
  }

  const tls = options.tls;
  if (!tls || !hasTlsMaterial(tls)) {
    return undefined;
  }

  return new https.Agent({
    cert: tls.cert,
    key: tls.key,
    ca: tls.ca,
    passphrase: tls.passphrase,
    pfx: tls.pfx,
    rejectUnauthorized: tls.rejectUnauthorized,
  });
}
