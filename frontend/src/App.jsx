import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function useAsync() {
  const [error, setError] = useState("");
  const run = useCallback(async (fn) => {
    setError("");
    try { return await fn(); } catch (e) { setError(e.message); return undefined; }
  }, []);
  return [error, run, setError];
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, run] = useAsync();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const res = mode === "login" ? await api.login(form.email, form.password) : await api.register(form.name, form.email, form.password);
      setToken(res.token);
      onAuth(res.user);
    });
  };

  return (
    <main className="auth">
      <h1>Hospital Management</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Sign in</button>
        <button role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Create patient account</button>
      </div>
      <form onSubmit={submit} className="stack">
        {mode === "register" && (
          <label>Full name<input required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" /></label>
        )}
        <label>Email<input required type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={8} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary">{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
    </main>
  );
}

function Appointments({ user, reload, items }) {
  const [error, run] = useAsync();
  const act = (id, status) => run(async () => { await api.setStatus(id, status); await reload(); });
  return (
    <section>
      <h2>Appointments</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {items.length === 0 && <p className="muted">No appointments yet.</p>}
      <ul className="list">
        {items.map((a) => (
          <li key={a._id}>
            <div>
              <strong>{fmt(a.scheduledAt)}</strong>
              <span className={`pill ${a.status}`}>{a.status}</span>
              <p className="muted">
                {user.role !== "patient" && <>Patient: {a.patient?.name} · </>}
                {user.role !== "doctor" && <>Dr. {a.doctor?.name}{a.doctor?.specialty ? ` (${a.doctor.specialty})` : ""} · </>}
                {a.reason}
              </p>
            </div>
            {a.status === "scheduled" && (
              <div className="row">
                {user.role !== "patient" && <button onClick={() => act(a._id, "completed")}>Mark completed</button>}
                <button className="ghost" onClick={() => act(a._id, "cancelled")}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookAppointment({ onBooked }) {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ doctorId: "", scheduledAt: "", reason: "" });
  const [error, run] = useAsync();
  useEffect(() => { api.doctors().then(setDoctors).catch(() => {}); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await api.book({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() });
      setForm({ doctorId: "", scheduledAt: "", reason: "" });
      await onBooked();
    });
  };

  return (
    <section>
      <h2>Book an appointment</h2>
      <form onSubmit={submit} className="grid">
        <label>Doctor
          <select required value={form.doctorId} onChange={set("doctorId")}>
            <option value="">Choose a doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ""}</option>)}
          </select>
        </label>
        <label>Date and time<input required type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")} /></label>
        <label className="wide">Reason<input required minLength={3} value={form.reason} onChange={set("reason")} /></label>
        <button className="primary">Book appointment</button>
      </form>
      {doctors.length === 0 && <p className="muted">No doctors are available yet.</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

function RecordView({ patient, canWrite, onNote }) {
  const [text, setText] = useState("");
  const [error, run] = useAsync();
  return (
    <div className="record">
      <h3>{patient.name}</h3>
      <p className="muted">
        {patient.gender || "Gender not set"} · {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "Date of birth not set"} · {patient.phone || "No phone"}
      </p>
      <h4>Clinical notes</h4>
      {(patient.notes || []).length === 0 && <p className="muted">No notes yet.</p>}
      <ul className="list">
        {(patient.notes || []).map((n) => (
          <li key={n._id}><div><p>{n.text}</p><p className="muted">Dr. {n.doctor?.name} · {fmt(n.createdAt)}</p></div></li>
        ))}
      </ul>
      {canWrite && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await onNote(text); setText(""); }); }}>
          <input aria-label="New note" required value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a clinical note" />
          <button className="primary">Save note</button>
        </form>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}

function Patients({ user }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, run] = useAsync();
  const load = useCallback(() => run(async () => setList(await api.patients(q))), [q, run]);
  useEffect(() => { load(); }, [load]);

  const open = (id) => run(async () => setSelected(await api.patient(id)));
  const remove = (p) => window.confirm(`Delete ${p.name} and all their appointments?`) && run(async () => {
    await api.deletePatient(p._id);
    if (selected?._id === p._id) setSelected(null);
    await load();
  });

  return (
    <section>
      <h2>Patients</h2>
      <input aria-label="Search patients" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="split">
        <ul className="list">
          {list.map((p) => (
            <li key={p._id}>
              <button className="link" onClick={() => open(p._id)}>{p.name}</button>
              {user.role === "admin" && <button className="ghost" onClick={() => remove(p)}>Delete</button>}
            </li>
          ))}
          {list.length === 0 && <p className="muted">No patients match.</p>}
        </ul>
        {selected && (
          <RecordView
            patient={selected}
            canWrite={user.role === "doctor"}
            onNote={async (text) => { await api.addNote(selected._id, text); await open(selected._id); }}
          />
        )}
      </div>
    </section>
  );
}

function AddStaff() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "doctor", specialty: "" });
  const [error, run] = useAsync();
  const [done, setDone] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <section>
      <h2>Add staff</h2>
      <form className="grid" onSubmit={(e) => { e.preventDefault(); setDone(""); run(async () => { const u = await api.createStaff(form); setDone(`Created ${u.role} ${u.name}`); setForm({ ...form, name: "", email: "", password: "", specialty: "" }); }); }}>
        <label>Name<input required value={form.name} onChange={set("name")} /></label>
        <label>Email<input required type="email" value={form.email} onChange={set("email")} /></label>
        <label>Temporary password<input required type="password" minLength={8} value={form.password} onChange={set("password")} /></label>
        <label>Role<select value={form.role} onChange={set("role")}><option value="doctor">Doctor</option><option value="admin">Admin</option></select></label>
        {form.role === "doctor" && <label>Specialty<input value={form.specialty} onChange={set("specialty")} /></label>}
        <button className="primary">Create account</button>
      </form>
      {done && <p role="status">{done}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}

function Dashboard({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [record, setRecord] = useState(null);
  const [tab, setTab] = useState("appointments");
  const [error, run] = useAsync();

  const reload = useCallback(() => run(async () => setItems(await api.appointments())), [run]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (user.role === "patient") api.myRecord().then(setRecord).catch(() => {}); }, [user]);

  const tabs = [["appointments", "Appointments"]];
  if (user.role === "patient") tabs.push(["record", "My record"]);
  if (user.role !== "patient") tabs.push(["patients", "Patients"]);
  if (user.role === "admin") tabs.push(["staff", "Staff"]);

  return (
    <main>
      <header className="top">
        <div><h1>Hospital Management</h1><p className="muted">{user.name} · {user.role}</p></div>
        <button className="ghost" onClick={onLogout}>Sign out</button>
      </header>
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      {error && <p role="alert" className="error">{error}</p>}
      {tab === "appointments" && (
        <>
          {user.role === "patient" && <BookAppointment onBooked={reload} />}
          <Appointments user={user} items={items} reload={reload} />
        </>
      )}
      {tab === "record" && record && <RecordView patient={record} canWrite={false} />}
      {tab === "patients" && <Patients user={user} />}
      {tab === "staff" && <AddStaff />}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setChecking(false));
  }, []);

  if (checking) return <main><p className="muted">Loading…</p></main>;
  if (!user) return <Auth onAuth={setUser} />;
  return <Dashboard user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}
