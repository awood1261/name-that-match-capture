const STATUS_CLASS = {
  info: 'info',
  error: 'error',
  success: 'success'
} as const;

definePopupActions();

function definePopupActions(): void {
  const triggerButton = document.getElementById('capture-button') as HTMLButtonElement | null;
  const statusNode = document.getElementById('status') as HTMLDivElement | null;

  if (!triggerButton || !statusNode) {
    return;
  }

  const setBusy = (isBusy: boolean): void => {
    triggerButton.disabled = isBusy;
    triggerButton.setAttribute('aria-busy', String(isBusy));
    triggerButton.textContent = isBusy ? 'Capturing…' : 'Capture paused frame';
  };

  setStatus(statusNode, 'Ready', 'info');

  triggerButton.addEventListener('click', () => {
    if (triggerButton.disabled) {
      return;
    }

    setStatus(statusNode, 'Capturing and saving…', 'info');
    setBusy(true);

    const responseTimeout = window.setTimeout(() => {
      setBusy(false);
      setStatus(
        statusNode,
        'Capture is taking longer than expected. Please wait or reload the tab if it does not finish.',
        'error'
      );
    }, 60000);

    chrome.runtime.sendMessage(
      {
        type: 'START_CAPTURE',
        requestId: `popup-${Date.now()}`
      },
      (result) => {
        window.clearTimeout(responseTimeout);
        setBusy(false);

        if (chrome.runtime.lastError) {
          setStatus(
            statusNode,
            chrome.runtime.lastError.message || 'Capture could not start.',
            'error'
          );
          return;
        }

        if (!result?.ok) {
          setStatus(
            statusNode,
            result?.message ?? 'Capture failed. Please retry from a paused YouTube watch page.',
            'error'
          );
          return;
        }

        setStatus(statusNode, result.message, 'success');
      }
    );
  });
}

function setStatus(node: HTMLDivElement, value: string, variant: keyof typeof STATUS_CLASS | null): void {
  node.textContent = value;
  node.classList.remove(...Object.values(STATUS_CLASS));

  if (variant) {
    node.classList.add(STATUS_CLASS[variant]);
  }
}
