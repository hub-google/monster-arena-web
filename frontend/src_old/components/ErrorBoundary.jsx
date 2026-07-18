import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-red-400 font-sans p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-red-500 w-full max-w-2xl overflow-auto">
            <h1 className="text-2xl font-bold mb-4 text-white">Oops! 遊戲發生錯誤 👾</h1>
            <p className="mb-4 text-gray-300">
              很抱歉，系統遇到未預期的錯誤，導致畫面無法正常顯示。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mb-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              重新載入頁面
            </button>
            <hr className="border-gray-600 mb-4" />
            <details className="text-left text-sm whitespace-pre-wrap">
              <summary className="cursor-pointer mb-2 font-semibold text-gray-400">查看錯誤詳情 (供開發者參考)</summary>
              <div className="bg-gray-900 p-2 rounded text-red-300">
                <p className="font-bold">{this.state.error && this.state.error.toString()}</p>
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
