import PublicNavbar from "../../../components/landing/PublicNavbar.jsx";
import React, { useState } from "react";
import styles from "./faq.module.css";
import {
  FaChevronDown,
  FaInstagram,
  FaFacebookF,
  FaEnvelope,
} from "react-icons/fa";

const FAQ = () => {
  const faqsData = [
    {
      question: "What is PuffyBrain?",
      answer:
        "PuffyBrain is a fun and easy quiz app that lets you test your knowledge on different topics.",
    },
    {
      question: "How do I take a quiz?",
      answer:
        "Go to the Quiz section, choose a category or topic, and tap Start Quiz. Answer each question and submit when finished.",
    },
    {
      question: "What are flashcards or decks?",
      answer:
        "Flashcards are small study cards that help you memorize concepts, terms, or questions. You can group them into decks based on a subject or topic.",
    },
    {
      question: "How do I create my own decks?",
      answer:
        "Go to the My Decks section, tap Create Deck, and give it a name. Then, start adding flashcards with a question or term on one side and an answer or definition on the other.",
    },
    {
      question: "How can I practice my flashcards?",
      answer:
        "After creating a deck, press the Practice button to start reviewing your flashcards. You can also choose any quiz type you prefer to practice your cards — for example, multiple choice, identification, or matching type.",
    },
    {
      question: "Can I retake a quiz or review my answers?",
      answer:
        "Yes, you can retake quizzes to improve your score or view your past results in the Results section.",
    },
  ];

  // Initialize state with `active` property
  const [faqs, setFaqs] = useState(
    faqsData.map((f) => ({ ...f, active: false })),
  );

  const toggleFAQ = (index) => {
    setFaqs(
      faqs.map((f, i) => (i === index ? { ...f, active: !f.active } : f)),
    );
  };

  return (
    <div className={styles.pageWrapper}>
      {/* HEADER */}
      <PublicNavbar />

      {/* FAQ SECTION */}
      <section className={styles.faqSection}>
        <h1 className={styles.faqHeading}>FREQUENTLY ASKED QUESTIONS</h1>
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`${styles.faqBox} ${faq.active ? styles.active : ""}`}
            onClick={() => toggleFAQ(index)}
          >
            <h2 className={styles.question}>
              {faq.question} <FaChevronDown />
            </h2>
            {faq.active && <p className={styles.answer}>{faq.answer}</p>}
          </div>
        ))}
      </section>

      {/* STILL HAVE QUESTIONS */}
      <section className={styles.questionsSection}>
        <h1>Still have questions?</h1>
        <p>
          If you cannot find answer to your question in our FAQ’s, you can
          always contact us. We will answer you shortly!
        </p>
      </section>

      
        {/* FOOTER */}
        <footer className={styles.footer}>
          <div className={styles.footerMenu}>
            <a href="/about">About Us</a>
            <a href="/toc">Terms and Conditions</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/contact">Contact Us</a>
          </div>

          <div className={styles.socialIcons}>
            <a href="#" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="#" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a
              href="mailto:puffybrain@gmail.com"
              aria-label="Email PuffyBrain"
            >
              <FaEnvelope />
            </a>
          </div>
        </footer>

        <div className={styles.subFooter}>
          <p>© 2025 – PuffyBrain All Rights Reserved</p>
        </div>

    </div>
  );
};

export default FAQ;
