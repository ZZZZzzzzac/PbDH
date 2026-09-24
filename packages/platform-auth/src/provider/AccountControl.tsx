import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useAuth } from "./AuthProvider.tsx";

export function AccountControl({
  className,
  icon,
  manageLabel,
  onManage,
  accountContent,
}: {
  className?: string;
  icon?: ReactNode;
  manageLabel?: string;
  onManage?: () => void;
  accountContent?: ReactNode;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signIn" | "signUp" | "forgotPassword">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const needsAttention = auth.status === "replacementRequired"
    || auth.status === "replaced"
    || auth.recovery !== "none"
    || (auth.status === "authenticated" && !auth.profile?.username);

  useEffect(() => {
    if (needsAttention) setOpen(true);
  }, [needsAttention]);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setMode("signIn");
  }, [auth.recovery]);

  const submitCredentials = (event: FormEvent) => {
    event.preventDefault();
    void (mode === "forgotPassword" ? auth.requestPasswordReset(email) : mode === "signIn" ? auth.signIn(email, password) : auth.signUp(email, password));
  };

  const buttonLabel = auth.status === "authenticated"
    ? auth.profile?.username ?? "设置用户名"
    : auth.status === "replaced"
      ? "会话失效"
      : "账号";

  return <>
    <button className={className} type="button" aria-label="账号" onClick={() => setOpen(true)}>
      {icon}{buttonLabel}
    </button>
    {open && <div className="pbdh-account-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget && !needsAttention) setOpen(false);
    }}>
      <section className="pbdh-account-dialog" role="dialog" aria-modal="true" aria-labelledby="pbdh-account-title">
        {!needsAttention && <button className="pbdh-account-close" type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button>}
        {renderDialog()}
      </section>
    </div>}
  </>;

  function renderDialog() {
    if (auth.recovery !== "none") {
      if (auth.recovery === "loading") return <h2 id="pbdh-account-title">正在验证恢复链接</h2>;
      if (auth.recovery === "invalid") return <>
        <h2 id="pbdh-account-title">恢复链接不可用</h2>
        <p role="alert">{auth.message ?? "恢复链接已过期或已使用，请重新申请恢复邮件。"}</p>
        <button type="button" onClick={() => void auth.cancelRecovery()}>返回登录</button>
      </>;
      return <form onSubmit={(event) => {
        event.preventDefault();
        if (auth.recovery !== "finishing" && password !== confirmPassword) { setPasswordError("两次输入的密码不一致。"); return; }
        setPasswordError(null);
        void auth.resetPassword(password);
      }}>
        <h2 id="pbdh-account-title">设置新密码</h2>
        <p>修改后需重新登录，旧设备将停止云端访问。人物存档和其他数据仍保留。</p>
        {auth.recovery !== "finishing" && <>
          <label className="pbdh-account-field"><span>新密码</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required disabled={auth.recoveryBusy} /></label>
          <label className="pbdh-account-field"><span>确认新密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required disabled={auth.recoveryBusy} /></label>
        </>}
        {(passwordError || auth.message) && <p className="pbdh-account-message" role="alert">{passwordError || auth.message}</p>}
        <div className="pbdh-account-actions">
          <button className="primary" type="submit" disabled={auth.recoveryBusy}>{auth.recoveryBusy ? "正在处理…" : auth.recovery === "finishing" ? "重试完成退出" : "重置密码"}</button>
          {auth.recovery !== "finishing" && <button type="button" disabled={auth.recoveryBusy} onClick={() => void auth.cancelRecovery()}>取消</button>}
        </div>
      </form>;
    }
    if (auth.status === "loading" || auth.status === "working") {
      return <><h2 id="pbdh-account-title">正在连接</h2></>;
    }
    if (!auth.authAvailable) {
      return <>
        <h2 id="pbdh-account-title">登录尚未配置</h2>
        <p>本地功能可正常使用。</p>
        {auth.message && <p className="pbdh-account-message">{auth.message}</p>}
      </>;
    }
    if (auth.status === "replacementRequired" || auth.status === "replaced") {
      return <>
        <h2 id="pbdh-account-title">{auth.status === "replaced" ? "云端会话已失效" : "账号已在另一设备登录"}</h2>
        <p>{auth.status === "replaced" ? "本地内容仍可编辑和导出。" : "继续会让旧设备停止云端写入。"}</p>
        {auth.message && <p className="pbdh-account-message">{auth.message}</p>}
        <div className="pbdh-account-actions">
          <button type="button" className="primary" onClick={() => void auth.confirmReplacement()}>在此设备继续</button>
          <button type="button" onClick={() => void auth.signOut()}>退出账号</button>
        </div>
      </>;
    }
    if (auth.status === "authenticated" && !auth.profile?.username) {
      return <form onSubmit={(event) => {
        event.preventDefault();
        void auth.updateUsername(username);
      }}>
        <h2 id="pbdh-account-title">设置用户名</h2>
        <label className="pbdh-account-field"><span>用户名</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus required /></label>
        {auth.message && <p className="pbdh-account-message" role="alert">{auth.message}</p>}
        <button className="primary" type="submit">保存</button>
      </form>;
    }
    if (auth.status === "authenticated" && auth.profile) {
      return <>
        <div className="pbdh-account-heading">
          <h2 id="pbdh-account-title">{auth.profile.username}</h2>
          {auth.profile.isAdmin && <span>管理员</span>}
        </div>
        <p className="pbdh-account-id">ID：{auth.profile.accountId}</p>
        {accountContent}
        <div className="pbdh-account-actions">
          {onManage && <button type="button" onClick={() => { setOpen(false); onManage(); }}>{manageLabel ?? "管理"}</button>}
          <button className="primary" type="button" onClick={() => setOpen(false)}>完成</button>
          <button type="button" onClick={() => void auth.signOut()}>退出登录</button>
        </div>
      </>;
    }
    return <>
      <h2 id="pbdh-account-title">{mode === "forgotPassword" ? "忘记密码" : mode === "signIn" ? "登录" : "注册"}</h2>
      <form onSubmit={submitCredentials}>
        <label className="pbdh-account-field"><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        {mode !== "forgotPassword" && <label className="pbdh-account-field"><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signIn" ? "current-password" : "new-password"} minLength={6} required /></label>}
        {auth.message && <p className="pbdh-account-message" role="alert">{auth.message}</p>}
        <div className="pbdh-account-actions">
          <button className="primary" type="submit" disabled={auth.recoveryBusy}>{mode === "forgotPassword" ? auth.recoveryBusy ? "正在发送…" : "发送恢复邮件" : mode === "signIn" ? "登录" : "创建账号"}</button>
          <button type="button" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
            {mode === "signIn" ? "注册账号" : "返回登录"}
          </button>
          {mode === "signIn" && <button type="button" onClick={() => { setPassword(""); setMode("forgotPassword"); }}>忘记密码？</button>}
        </div>
      </form>
    </>;
  }
}
