import { useId, useState } from 'react';

import type { StatusResponse, SubscriptionUrls } from '../../../shared/contracts/profile';
import { ConversionError, convertProfile, type ConvertedProfile } from '../converter';
import { fetchStatus, publishProfile } from './api';

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };
  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={`复制${label}地址`}>
      {copied ? '已复制' : '复制'}
    </button>
  );
};

const SubscriptionLinks = ({ urls }: { urls: SubscriptionUrls }) => (
  <section className="result-card" aria-labelledby="subscription-title">
    <div className="section-heading">
      <span className="step-badge complete">3</span>
      <div>
        <h2 id="subscription-title">固定订阅地址</h2>
        <p>保存一次即可，后续上传新配置时地址不变。</p>
      </div>
    </div>
    <div className="link-list">
      {(
        [
          ['Surge', urls.surge],
          ['Quantumult X', urls.quanx],
        ] as const
      ).map(([label, value]) => (
        <div className="subscription-link" key={label}>
          <div>
            <strong>{label}</strong>
            <code>{value}</code>
          </div>
          <CopyButton value={value} label={label} />
        </div>
      ))}
    </div>
  </section>
);

export function ProfileUploader() {
  const tokenId = useId();
  const fileId = useId();
  const [adminToken, setAdminToken] = useState('');
  const [converted, setConverted] = useState<ConvertedProfile>();
  const [issues, setIssues] = useState<readonly string[]>([]);
  const [status, setStatus] = useState<StatusResponse>();
  const [busy, setBusy] = useState<'status' | 'publish'>();
  const [requestError, setRequestError] = useState('');

  const handleFile = async (file: File | undefined) => {
    setIssues([]);
    setRequestError('');
    setConverted(undefined);
    if (!file) return;
    try {
      const source = await file.text();
      setConverted(convertProfile(file.name, source));
    } catch (error) {
      setIssues(
        error instanceof ConversionError
          ? error.issues
          : [error instanceof Error ? error.message : '文件解析失败'],
      );
    }
  };

  const loadStatus = async () => {
    if (!adminToken) return;
    setBusy('status');
    setRequestError('');
    try {
      setStatus(await fetchStatus(adminToken));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '读取状态失败');
    } finally {
      setBusy(undefined);
    }
  };

  const publish = async () => {
    if (!converted || !adminToken) return;
    setBusy('publish');
    setRequestError('');
    try {
      const response = await publishProfile(adminToken, {
        sourceName: converted.sourceName,
        sourceFormat: converted.sourceFormat,
        source: converted.source,
        surge: converted.surge,
        quanx: converted.quanx,
        warnings: converted.warnings,
        ignoredSections: converted.ignoredSections,
        stats: converted.stats,
      });
      setStatus({ current: response.metadata, urls: response.urls });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '发布失败');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <main>
      <header className="hero">
        <div className="brand-mark" aria-hidden="true">
          PX
        </div>
        <div>
          <p className="eyebrow">Private profile relay</p>
          <h1>代理配置转换器</h1>
          <p className="hero-copy">
            上传 Clash YAML 或 Surge CONF，一次生成两个长期可用的私有订阅地址。
          </p>
        </div>
      </header>

      <section className="workflow-card" aria-labelledby="auth-title">
        <div className="section-heading">
          <span className="step-badge">1</span>
          <div>
            <h2 id="auth-title">验证管理权限</h2>
            <p>令牌只保留在当前页面内，不会写入浏览器存储。</p>
          </div>
        </div>
        <div className="token-row">
          <label htmlFor={tokenId}>管理令牌</label>
          <div className="input-action">
            <input
              id={tokenId}
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="输入 ADMIN_TOKEN"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={!adminToken || Boolean(busy)}
              onClick={loadStatus}
            >
              {busy === 'status' ? '读取中…' : '读取状态'}
            </button>
          </div>
        </div>
        {status?.current && (
          <p className="current-status">
            当前版本：{status.current.sourceName} · {formatDate(status.current.publishedAt)}
          </p>
        )}
      </section>

      <section className="workflow-card" aria-labelledby="upload-title">
        <div className="section-heading">
          <span className="step-badge">2</span>
          <div>
            <h2 id="upload-title">选择并转换配置</h2>
            <p>转换在本机浏览器完成，确认结果后才会上传。</p>
          </div>
        </div>
        <label className="drop-zone" htmlFor={fileId}>
          <span className="upload-icon" aria-hidden="true">
            ↑
          </span>
          <strong>选择 YAML 或 CONF 文件</strong>
          <span>最大 2 MB；优先使用 Clash YAML，缺少 YAML 时再使用 Surge CONF</span>
          <input
            id={fileId}
            type="file"
            aria-label="配置文件"
            accept=".yaml,.yml,.conf,text/yaml,text/plain"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>

        {issues.length > 0 && (
          <div className="message error" role="alert">
            <strong>配置无法发布</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {converted && (
          <div className="conversion-summary">
            <div className="file-summary">
              <div>
                <strong>{converted.sourceName}</strong>
                <span>{converted.sourceFormat === 'clash' ? 'Clash YAML' : 'Surge CONF'}</span>
              </div>
              <span className="ready-pill">转换完成</span>
            </div>
            <dl className="stats-grid">
              <div>
                <dt>节点</dt>
                <dd>{converted.stats.proxies}</dd>
              </div>
              <div>
                <dt>策略组</dt>
                <dd>{converted.stats.groups}</dd>
              </div>
              <div>
                <dt>规则</dt>
                <dd>{converted.stats.rules}</dd>
              </div>
              <div>
                <dt>QX 跳过</dt>
                <dd>{converted.stats.skippedRules}</dd>
              </div>
            </dl>
            {converted.warnings.length > 0 && (
              <div className="message warning">
                <strong>转换提示</strong>
                <ul>
                  {converted.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={!adminToken || Boolean(busy)}
              onClick={publish}
            >
              {busy === 'publish' ? '正在发布…' : '发布并更新两个地址'}
            </button>
            {!adminToken && <p className="field-hint">输入管理令牌后即可发布。</p>}
          </div>
        )}
      </section>

      {requestError && (
        <div className="message error global-message" role="alert">
          {requestError}
        </div>
      )}
      {status && <SubscriptionLinks urls={status.urls} />}

      <footer>
        <span>转换发生在浏览器</span>
        <span aria-hidden="true">·</span>
        <span>产物保存在私有 R2</span>
      </footer>
    </main>
  );
}
