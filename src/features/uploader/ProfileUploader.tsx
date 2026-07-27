import { useId, useState } from 'react';

import type {
  ProfileSlot,
  ProfileSlots,
  PublishedProfileMetadata,
  StatusResponse,
  SubscriptionUrls,
} from '../../../shared/contracts/profile';
import { ConversionError, convertProfile, type ConvertedProfile } from '../converter';
import { fetchStatus, publishProfile } from './api';

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const slotDetails: ProfileSlots<{
  readonly title: string;
  readonly badge: string;
  readonly description: string;
}> = {
  primary: {
    title: '主用配置',
    badge: '主',
    description: '上传主力代理的 YAML 或 CONF，原有订阅地址保持不变。',
  },
  backup: {
    title: '备用配置',
    badge: '备',
    description: '上传备用代理的 YAML 或 CONF，生成另一组独立固定地址。',
  },
};

interface SlotState {
  readonly converted?: ConvertedProfile;
  readonly issues: readonly string[];
}

const initialSlotStates = (): ProfileSlots<SlotState> => ({
  primary: { issues: [] },
  backup: { issues: [] },
});

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

const SubscriptionGroup = ({
  slot,
  urls,
  current,
}: {
  slot: ProfileSlot;
  urls: SubscriptionUrls;
  current: PublishedProfileMetadata | null;
}) => {
  const details = slotDetails[slot];
  return (
    <section className="subscription-group" aria-labelledby={`${slot}-subscription-title`}>
      <div className="subscription-group-heading">
        <div>
          <span className={`slot-badge ${slot}`}>{details.badge}</span>
          <h3 id={`${slot}-subscription-title`}>{details.title}订阅</h3>
        </div>
        <span className={current ? 'published-pill' : 'empty-pill'}>
          {current ? '已发布' : '等待首次发布'}
        </span>
      </div>
      {current ? (
        <p className="subscription-source">
          {current.sourceName} · {formatDate(current.publishedAt)}
        </p>
      ) : null}
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
            <CopyButton value={value} label={`${details.title}${label}`} />
          </div>
        ))}
      </div>
    </section>
  );
};

const SubscriptionLinks = ({ status }: { status: StatusResponse }) => (
  <section className="result-card" aria-labelledby="subscription-title">
    <div className="section-heading">
      <span className="step-badge complete">3</span>
      <div>
        <h2 id="subscription-title">固定订阅地址</h2>
        <p>主用与备用互不覆盖，各保存一次即可长期刷新。</p>
      </div>
    </div>
    <div className="subscription-grid">
      <SubscriptionGroup
        slot="primary"
        urls={status.urls.primary}
        current={status.profiles.primary}
      />
      <SubscriptionGroup slot="backup" urls={status.urls.backup} current={status.profiles.backup} />
    </div>
  </section>
);

const ProfileSlotCard = ({
  slot,
  state,
  current,
  publishing,
  disabled,
  hasAdminToken,
  onFile,
  onPublish,
}: {
  slot: ProfileSlot;
  state: SlotState;
  current: PublishedProfileMetadata | null | undefined;
  publishing: boolean;
  disabled: boolean;
  hasAdminToken: boolean;
  onFile: (slot: ProfileSlot, file: File | undefined) => void;
  onPublish: (slot: ProfileSlot) => void;
}) => {
  const fileId = useId();
  const details = slotDetails[slot];
  const { converted, issues } = state;

  return (
    <article className="profile-slot-card">
      <div className="slot-heading">
        <span className={`slot-badge ${slot}`}>{details.badge}</span>
        <div>
          <h3>{details.title}</h3>
          <p>{details.description}</p>
        </div>
      </div>

      {current ? (
        <p className="current-status">
          当前：{current.sourceName} · {formatDate(current.publishedAt)}
        </p>
      ) : (
        <p className="current-status">当前还没有已发布配置。</p>
      )}

      <label className="drop-zone compact" htmlFor={fileId}>
        <span className="upload-icon" aria-hidden="true">
          ↑
        </span>
        <strong>选择 YAML 或 CONF</strong>
        <span>二选一即可，最大 2 MB</span>
        <input
          id={fileId}
          type="file"
          aria-label={`${details.title}文件`}
          accept=".yaml,.yml,.conf,text/yaml,text/plain"
          onChange={(event) => onFile(slot, event.target.files?.[0])}
        />
      </label>

      {issues.length > 0 ? (
        <div className="message error" role="alert">
          <strong>{details.title}无法发布</strong>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {converted ? (
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
          {converted.warnings.length > 0 ? (
            <div className="message warning">
              <strong>转换提示</strong>
              <ul>
                {converted.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            className="primary-button"
            type="button"
            disabled={disabled}
            onClick={() => onPublish(slot)}
          >
            {publishing ? `正在发布${details.title}…` : `发布${details.title}`}
          </button>
          {!hasAdminToken ? <p className="field-hint">输入管理令牌后即可发布。</p> : null}
        </div>
      ) : null}
    </article>
  );
};

export function ProfileUploader() {
  const tokenId = useId();
  const [adminToken, setAdminToken] = useState('');
  const [slotStates, setSlotStates] = useState<ProfileSlots<SlotState>>(initialSlotStates);
  const [status, setStatus] = useState<StatusResponse>();
  const [busy, setBusy] = useState<'status' | ProfileSlot>();
  const [requestError, setRequestError] = useState('');

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

  const handleFile = async (slot: ProfileSlot, file: File | undefined) => {
    setRequestError('');
    setSlotStates((current) => ({
      ...current,
      [slot]: { issues: [] },
    }));
    if (!file) return;

    try {
      const source = await file.text();
      const converted = convertProfile(file.name, source);
      setSlotStates((current) => ({
        ...current,
        [slot]: { converted, issues: [] },
      }));
    } catch (error) {
      const issues =
        error instanceof ConversionError
          ? error.issues
          : [error instanceof Error ? error.message : '文件解析失败'];
      setSlotStates((current) => ({
        ...current,
        [slot]: { issues },
      }));
    }
  };

  const publish = async (slot: ProfileSlot) => {
    const converted = slotStates[slot].converted;
    if (!converted || !adminToken) return;
    setBusy(slot);
    setRequestError('');
    try {
      const response = await publishProfile(adminToken, {
        slot,
        sourceName: converted.sourceName,
        sourceFormat: converted.sourceFormat,
        source: converted.source,
        surge: converted.surge,
        quanx: converted.quanx,
        warnings: converted.warnings,
        ignoredSections: converted.ignoredSections,
        stats: converted.stats,
      });
      setStatus({ profiles: response.profiles, urls: response.urls });
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
            分别维护主用与备用代理；每个代理上传 YAML 或 CONF 其中之一，即可生成独立固定订阅。
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
              onClick={() => void loadStatus()}
            >
              {busy === 'status' ? '读取中…' : '读取状态'}
            </button>
          </div>
        </div>
      </section>

      <section className="workflow-card" aria-labelledby="upload-title">
        <div className="section-heading">
          <span className="step-badge">2</span>
          <div>
            <h2 id="upload-title">选择并转换配置</h2>
            <p>两个入口互相独立，转换均在本机浏览器完成，可分别更新。</p>
          </div>
        </div>
        <div className="profile-slot-grid">
          <ProfileSlotCard
            slot="primary"
            state={slotStates.primary}
            current={status?.profiles.primary}
            publishing={busy === 'primary'}
            disabled={!adminToken || Boolean(busy)}
            hasAdminToken={Boolean(adminToken)}
            onFile={(slot, file) => void handleFile(slot, file)}
            onPublish={(slot) => void publish(slot)}
          />
          <ProfileSlotCard
            slot="backup"
            state={slotStates.backup}
            current={status?.profiles.backup}
            publishing={busy === 'backup'}
            disabled={!adminToken || Boolean(busy)}
            hasAdminToken={Boolean(adminToken)}
            onFile={(slot, file) => void handleFile(slot, file)}
            onPublish={(slot) => void publish(slot)}
          />
        </div>
      </section>

      {requestError ? (
        <div className="message error global-message" role="alert">
          {requestError}
        </div>
      ) : null}
      {status ? <SubscriptionLinks status={status} /> : null}

      <footer>
        <span>转换发生在浏览器</span>
        <span aria-hidden="true">·</span>
        <span>主用与备用分别保存在私有 KV</span>
      </footer>
    </main>
  );
}
