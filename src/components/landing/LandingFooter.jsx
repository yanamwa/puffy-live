export default function LandingFooter() {
  return (
    <footer
      style={{
        width: "100%",
        padding: "2rem 1.5rem",
        background: "#7199c6",
        textAlign: "center",
        color: "#ffffff",
        fontWeight: 600,
        marginTop: "2rem",
      }}
    >
      <p style={{ margin: 0 }}>
        © {new Date().getFullYear()} PuffyBrain. Built for study happiness.
      </p>
    </footer>
  );
}
