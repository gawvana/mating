import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  retryLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      // Clear potentially corrupted motion profile from localStorage on reset if needed
      this.setState({ hasError: false, error: null, errorInfo: null });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  private handleClearData = () => {
    try {
      localStorage.removeItem("mating_motion_profile");
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            background: "var(--bg, #0b0b10)",
            color: "var(--on, #fff)",
            fontFamily: "var(--font, system-ui, sans-serif)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "18px",
              background: "rgba(255, 69, 58, 0.12)",
              color: "#ff453a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              marginBottom: "16px",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px 0" }}>
            {this.props.fallbackTitle || "Mating не удалось загрузить"}
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--muted, #8e8e93)",
              margin: "0 0 20px 0",
              maxWidth: "320px",
              lineHeight: 1.4,
            }}
          >
            {this.props.fallbackMessage ||
              "Произошла ошибка при отображении страницы. Нажмите кнопку ниже для перезагрузки."}
          </p>

          {/* Diagnostic error box for immediate debugging */}
          {this.state.error && (
            <div
              style={{
                width: "100%",
                maxWidth: "360px",
                background: "rgba(0, 0, 0, 0.35)",
                border: "1px solid rgba(255, 69, 58, 0.3)",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "20px",
                textAlign: "left",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#ff453a", marginBottom: "4px" }}>
                {this.state.error.name}: {this.state.error.message}
              </div>
              {this.state.error.stack && (
                <pre
                  style={{
                    fontSize: "10px",
                    color: "rgba(255, 255, 255, 0.6)",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {this.state.error.stack.split("\n").slice(0, 4).join("\n")}
                </pre>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={this.handleReset}
              className="btn btn-p press"
              style={{
                minWidth: "140px",
                padding: "12px 20px",
                height: "44px",
                borderRadius: "22px",
                background: "var(--primary, #4F5DFF)",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {this.props.retryLabel || "Повторить"}
            </button>
            <button
              onClick={this.handleClearData}
              className="btn outline press"
              style={{
                minWidth: "140px",
                padding: "12px 20px",
                height: "44px",
                borderRadius: "22px",
                border: "1px solid var(--outline, rgba(255,255,255,0.2))",
                color: "var(--on, #fff)",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              Сбросить кэш UI
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
