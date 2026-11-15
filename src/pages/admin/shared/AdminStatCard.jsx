import "./AdminStatCard.css";

export default function AdminStatCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-card-icon" aria-hidden="true">
        <Icon />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
