export const RESULTS_PER_PAGE = 5;

export default function ResultsPagination({ label, tableId, page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="home-results-pagination" aria-label={label}>
      <button
        type="button"
        aria-controls={tableId}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span role="status">Page {page} of {pageCount}</span>
      <button
        type="button"
        aria-controls={tableId}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
