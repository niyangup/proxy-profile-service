import { canConvertNatively, convertResource } from './index';

interface QuantumultResource {
  readonly content?: string;
  readonly link?: string;
  readonly type?: string;
  readonly [key: string]: unknown;
}

type Notify = (title: string, subtitle?: string, message?: string, options?: unknown) => void;

declare const $resource: QuantumultResource | undefined;
declare const $notify: Notify | undefined;

// These globals are declared by scripts/build.mjs. Keeping them unbound here
// prevents esbuild from renaming the hand-off between the native bundle and
// the conditionally appended KOP runtime.
declare let $kopResource: QuantumultResource | undefined;
declare let $useKopFallback: boolean;

// Mark the build-assembly globals as read in this module as well as assigned.
// esbuild removes these side-effect-free expressions from the final bundle.
void $kopResource;
void $useKopFallback;

const notify: Notify = (title, subtitle, message, options): void => {
  if (typeof $notify === 'function') $notify(title, subtitle, message, options);
};

const resource = typeof $resource === 'undefined' ? undefined : $resource;
const source = resource?.content ?? '';
const isServer = resource?.type === undefined || resource.type === 'server';
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

    // The focused converter owns YAML/CONF parsing, while KOP's proven
    // top-level server path owns the final Quantumult X callback shape.
    $kopResource = { ...resource, content: result.content };
    $useKopFallback = true;
    nativeHandled = true;
  } catch {
    // KOP-XIAO gets the untouched input when the focused native converter cannot handle it.
  }
}

if (!nativeHandled) {
  $kopResource = resource;
  $useKopFallback = true;
}
