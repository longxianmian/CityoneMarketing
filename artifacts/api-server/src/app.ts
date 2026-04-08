import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import http from "http";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Must be BEFORE body-parsers so raw multipart stream is forwarded intact
app.use(
  "/api/upload",
  createProxyMiddleware({
    target: "http://localhost:3100",
    changeOrigin: true,
    pathRewrite: { "^": "/api/upload" },
    proxyTimeout: 120000,
    timeout: 120000,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", (req: Request, res: Response) => {
  const options: http.RequestOptions = {
    hostname: "localhost",
    port: 3100,
    path: `/uploads${req.url}`,
    method: req.method,
    headers: { ...req.headers, host: "localhost:3100" },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxy.on("error", () => {
    if (!res.headersSent) res.status(502).json({ code: 502, msg: "Upload backend unavailable" });
  });
  req.pipe(proxy);
});

app.use("/api/agent", (req: Request, res: Response) => {
  const body =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;

  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: "localhost:3100",
  };
  if (body) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(body));
  }

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: 3100,
    path: `/api/agent${req.url}`,
    method: req.method,
    headers,
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on("error", () => {
    if (!res.headersSent) {
      res.status(502).json({ code: 502, msg: "Agent backend unavailable" });
    }
  });

  if (body) {
    proxy.write(body);
    proxy.end();
  } else {
    req.pipe(proxy);
  }
});

app.use("/api", router);

app.use("/api", (req: Request, res: Response) => {
  const body =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;

  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: "localhost:3100",
  };
  if (body) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(body));
  }

  const options: http.RequestOptions = {
    hostname: "localhost",
    port: 3100,
    path: `/api${req.url}`,
    method: req.method,
    headers,
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on("error", () => {
    if (!res.headersSent) {
      res.status(502).json({ code: 502, msg: "Backend unavailable" });
    }
  });

  if (body) {
    proxy.write(body);
    proxy.end();
  } else {
    req.pipe(proxy);
  }
});

export default app;
