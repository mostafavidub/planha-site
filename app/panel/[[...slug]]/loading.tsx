export default function Loading() {
  return (
    <main
      className="route-loading panel-loading"
      dir="rtl"
      aria-live="polite"
      aria-label="در حال بارگذاری صفحه"
    >
      <aside />
      <section>
        <header />
        <div className="loading-lines">
          <i />
          <i />
          <i />
        </div>
        <div className="loading-cards">
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
    </main>
  );
}
