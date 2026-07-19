import { useLocation } from 'react-router-dom';

export function ScreenTransition({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey?: string;
}) {
  let key = routeKey;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    key = key ?? useLocation().pathname;
  } catch {
    key = key ?? 'default';
  }
  return (
    <div key={key} className="mo-screen">
      {children}
    </div>
  );
}

export default ScreenTransition;
