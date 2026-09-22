import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import AuthLayout from "../components/AuthLayout";
import TextField from "../components/TextField";
import { User, Mail, Lock } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/signup", { name, email, password });
      localStorage.setItem("token", response.data.token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Sign up">
      <form onSubmit={handleSubmit}>
        <TextField label="Name" value={name} onChange={setName} icon={<User size={16} />} />
        <TextField label="Email" type="email" value={email} onChange={setEmail} icon={<Mail size={16} />} />
        <TextField label="Password" type="password" value={password} onChange={setPassword} icon={<Lock size={16} />} />

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="primary-btn"
          style={{
            width: "100%",
            padding: "12px",
            background: "var(--accent)",
            color: "var(--accent-dark)",
            fontSize: 15,
          }}
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, textAlign: "center" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}