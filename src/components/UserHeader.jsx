import { useEffect } from "react";
import { FiBell, FiCheckCircle } from "react-icons/fi";
import styles from "../pages/course/Learning_Module.module.css";
import { fetchManagedNotificationsFromServer } from "../utils/notifications";
import confirmLogout from "../utils/confirmLogout.js";

export default function UserHeader({
  searchQuery,
  setSearchQuery,
  handleSearchSubmit,
  notificationOpen,
  setNotificationOpen,
  notificationCount = 0,
  notifications = [],
  markNotificationsAsRead,
  user = {},
  profileDropdownOpen,
  setProfileDropdownOpen,
  handleLogout,
}) {
  const confirmAndLogout = async () => {
    if (!(await confirmLogout())) return;
    handleLogout?.();
  };

  useEffect(() => {
    fetchManagedNotificationsFromServer().catch(() => {});
  }, []);

  return (
    <header className={styles.headerContainer}>
      <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery?.(event.target.value)}
          placeholder="Search..."
        />
        <span aria-hidden="true">S</span>
      </form>

      <div className={styles.profileWrapper}>
        <div className={styles.notificationWrapper}>
          <button
            className={`${styles.notificationBtn} ${
              notificationOpen ? styles.notificationActive : ""
            }`}
            type="button"
            onClick={() => setNotificationOpen?.((current) => !current)}
            aria-label={`Notifications${
              notificationCount > 0 ? `, ${notificationCount} unread` : ""
            }`}
            aria-expanded={notificationOpen}
            aria-haspopup="dialog"
          >
            <FiBell aria-hidden="true" />
            {notificationCount > 0 && (
              <span className={styles.notificationBadge}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {notificationOpen && (
            <section
              className={styles.notificationDropdown}
              role="dialog"
              aria-label="Notifications"
            >
              <div className={styles.notificationHeader}>
                <div>
                  <h2>Notifications</h2>
                  <span>
                    {notificationCount > 0
                      ? `${notificationCount} unread`
                      : "You are all caught up"}
                  </span>
                </div>

                {notificationCount > 0 && (
                  <button
                    className={styles.markReadBtn}
                    type="button"
                    onClick={markNotificationsAsRead}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className={styles.notificationTabs}>
                <button type="button" className={styles.notificationTabActive}>
                  All
                </button>
                <button type="button">Unread</button>
              </div>

              <div className={styles.notificationList}>
                {notifications.length === 0 ? (
                  <div className={styles.emptyNotification}>
                    <span className={styles.emptyNotificationIcon}>
                      <FiBell aria-hidden="true" />
                    </span>
                    <strong>No notifications yet</strong>
                    <p>New updates will appear here.</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification, index) => {
                    const isUnread =
                      notification.status === "unread" || notification.unread;

                    return (
                      <article
                        className={`${styles.notificationItem} ${
                          isUnread ? styles.unread : ""
                        }`}
                        key={notification.id || index}
                      >
                        <span
                          className={styles.notificationItemIcon}
                          aria-hidden="true"
                        >
                          <FiCheckCircle />
                        </span>

                        <span className={styles.notificationItemCopy}>
                          <strong>
                            {notification.title || "Notification"}
                          </strong>
                          <span>
                            {notification.message || notification.body || ""}
                          </span>
                          <small>
                            {notification.time ||
                              notification.created_at ||
                              notification.date ||
                              ""}
                          </small>
                        </span>

                        {isUnread && (
                          <span
                            className={styles.notificationUnreadDot}
                            aria-label="Unread"
                          />
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          )}
        </div>

        <button
          className={styles.profileLink}
          type="button"
          onClick={() => setProfileDropdownOpen?.((current) => !current)}
        >
          <span className={styles.dpContainer}>
            <img
              className={styles.profilePic}
              src={user.profile_image || "/images/temporary profile.jpg"}
              alt=""
            />
          </span>
          <span className={styles.userInfo}>
            <p>@{user.username || "user"}</p>
          </span>
        </button>

        <div className={styles.dropdown}>
          <div
            className={`${styles.dropdownContent} ${
              profileDropdownOpen ? styles.show : ""
            }`}
          >
            <button type="button" onClick={confirmAndLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
