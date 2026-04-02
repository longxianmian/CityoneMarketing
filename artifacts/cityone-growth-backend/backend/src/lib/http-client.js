export async function httpGetJson(url, query = {}, headers = {}) {
  const fullUrl = buildUrl(url, query);

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...headers
    }
  });

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    url: fullUrl,
    text,
    json: safeParseJson(text)
  };
}

export async function httpPostJson(url, body = {}, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    url,
    request_body: body,
    text,
    json: safeParseJson(text)
  };
}

function buildUrl(baseUrl, query) {
  const url = new URL(baseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
