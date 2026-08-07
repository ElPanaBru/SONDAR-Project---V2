import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de render en SONDAR:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="ruta-no-encontrada" role="alert">
          <span>!</span>
          <h1>Algo salio mal</h1>
          <p>Recarga la pagina para volver a intentarlo.</p>
          <button type="button" onClick={() => window.location.reload()}>Recargar</button>
        </main>
      );
    }
    return this.props.children;
  }
}
