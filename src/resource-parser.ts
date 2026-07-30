import { canConvertNatively, convertResource } from './index';

interface QuantumultResource {
  readonly content?: string;
  readonly link?: string;
  readonly type?: string;
  readonly [key: string]: unknown;
}

interface QuantumultResult {
  readonly content?: string;
  readonly info?: unknown;
  readonly retry?: unknown;
  readonly [key: string]: unknown;
}

type ParserHelper = Record<string, unknown>;
type Done = (result: QuantumultResult) => void;
type Notify = (title: string, subtitle?: string, message?: string, options?: unknown) => void;

declare const $resource: QuantumultResource | undefined;
declare const $done: Done;
declare const $notify: Notify | undefined;
declare const $parser: ParserHelper;
declare const executeVendoredKop: (
  resource: QuantumultResource | undefined,
  parser: ParserHelper,
  done: Done,
  notify: Notify,
) => void;

const notify: Notify = (title, subtitle, message, options): void => {
  if (typeof $notify === 'function') $notify(title, subtitle, message, options);
};

let doneCalled = false;
const doneOnce: Done = (result): void => {
  if (doneCalled) return;
  doneCalled = true;
  $done(result);
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '未知错误';

const runKopParser = (resource: QuantumultResource | undefined, parser: ParserHelper): void => {
  let capturedResult: QuantumultResult | undefined;
  try {
    executeVendoredKop(
      resource,
      parser,
      (result) => {
        // KOP can call its callback multiple times. Its first result is the
        // actionable parser response; a later compatibility callback may add
        // an empty `info: {}`, which Quantumult X rejects as an invalid type.
        capturedResult ??= result;
      },
      notify,
    );
  } catch (error) {
    notify('Quantumult X 资源解析失败', 'KOP-XIAO 回退解析器执行失败', errorMessage(error));
  }

  if (capturedResult) {
    doneOnce(capturedResult);
  } else {
    doneOnce({ content: '' });
  }
};

const resource = typeof $resource === 'undefined' ? undefined : $resource;
const parser = typeof $parser === 'undefined' ? {} : $parser;
const source = resource?.content ?? '';
const isServer = resource?.type === undefined || resource.type === 'server';
const hasKopParameters = resource?.link?.includes('#') ?? false;
let nativeHandled = false;

if (isServer && canConvertNatively(source)) {
  try {
    const result = convertResource(source);
    if (result.skippedNodes > 0) {
      notify(
        'Quantumult X 资源解析完成',
        `已转换 ${result.convertedNodes} 个节点，跳过 ${result.skippedNodes} 个`,
        result.warnings.slice(0, 3).join('\n'),
      );
    }

    if (hasKopParameters) {
      runKopParser({ ...resource, content: result.content }, parser);
    } else {
      // Quantumult X's official resource-parser example returns native node lines.
      doneOnce({ content: result.content });
    }
    nativeHandled = true;
  } catch {
    // KOP-XIAO gets the untouched input when the focused native converter cannot handle it.
  }
}

if (!nativeHandled) {
  runKopParser(resource, parser);
}
