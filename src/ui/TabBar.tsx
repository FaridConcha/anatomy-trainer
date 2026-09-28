export function TabBar({ current }: { current: string }) {
  const tabs = [
    ['', 'Decks'],
    ['settings', 'Settings'],
  ];
  const on = (id: string) => (id === '' ? ['', 'deck', 'play', 'review', 'learn'].includes(current) : current === id);
  return (
    <div className="tabbar">
      <nav>
        {tabs.map(([id, label]) => (
          <a key={id} href={`#/${id}`} className={on(id) ? 'on' : ''}>
            <b />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
