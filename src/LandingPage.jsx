import { useEffect } from "react";
import styles from "./LandingPage.module.css";
import PublicNavbar from "./components/landing/PublicNavbar";
import LandingFooter from "./components/landing/LandingFooter";

function LandingPage() {
  useEffect(() => {
    const elements = document.querySelectorAll(`.${styles.fadeIn}`);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.show);
          } else {
            entry.target.classList.remove(styles.show);
          }
        });
      },
      { threshold: 0.15 },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className={styles.wrapper}>
        <section className={styles.container}>
          <div className={styles.background}></div>
          <PublicNavbar />
          <section className={styles.heroBg}>
            <div className={styles.heroContent}>
              <p className={styles.studySecret}>shhh... a study secret</p>

              <h1>
                Your quizzes are waiting
                <br />
                let's make your brain giggle!
              </h1>

              <p className={styles.sub}>Let's Puff Up Those Brain Cells!</p>

              <a href="/login">
                <button className={styles.pressStart}>Press to Start</button>
              </a>
            </div>
          </section>
        </section>
      </div>

      <div className={styles.cloudContainer}>
        <img
          src="/images/clouds sa landing page.png"
          className={styles.cloudImg}
          alt="Clouds"
        />
      </div>

      <div className={styles.cloudBottomFade}></div>

      <section className={styles.features}>
        <div className={`${styles.feature} ${styles.reverse} ${styles.fadeIn}`}>
          <img
            src="/images/masterpractice.png"
            className={styles.frame}
            alt="Master through practice"
          />

          <div className={styles.text}>
            <h2>Master through practice</h2>

            <p>
              Test yourself with the tools you create. Whether it's quick
              flashcards for memorization or full quizzes for deeper review,
              PuffyBrain helps you practice smarter and retain more.
            </p>
          </div>
        </div>

        <div className={`${styles.feature} ${styles.fadeIn}`}>
          <img
            src="/images/organized.png"
            className={styles.frame}
            alt="Stay organized"
          />

          <div className={styles.text}>
            <h2>Stay organized with decks</h2>

            <p>
              Keep your study materials neatly grouped into decks. Review them
              anytime, anywhere, perfect for exam prep, daily practice, or
              brushing up on specific topics.
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}

export default LandingPage;
