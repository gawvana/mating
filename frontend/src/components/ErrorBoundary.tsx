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
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
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
              margin: "0 0 24px 0",
              maxWidth: "280px",
              lineHeight: 1.4,
            }}
          >
            {this.props.fallbackMessage || "Произошла непредвиденная ошибка интерфейса. Нажмите кнопку ниже для повторной попытки."}
          </p>
          <button
            onClick={this.handleReset}
            className="btn btn-p press"
            style={{ minWidth: "160px", padding: "12px 20px" }}
          >
            {this.props.retryLabel || "[Повторить]"}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
