import React, { useEffect, useState } from 'react';

export default function Comunidad() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // El "puente" al servidor que tú manejas
    fetch('http://localhost:3000/api/posts/muro')
      .then(res => res.json())
      .then(data => setPosts(data))
      .catch(err => console.error("Error al conectar:", err));
  }, []);

  return (
    <div className="container mt-4">
      <h1 className="text-primary">Hola, comunidad</h1>
      <hr />
      <div className="row">
        {posts.map(post => (
          <div key={post.id} className="col-md-6 mb-3">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title text-info">@{post.usuario}</h5>
                <p className="card-text">{post.texto}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}