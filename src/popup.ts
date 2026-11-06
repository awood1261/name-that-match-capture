const STATUS_CLASS = {
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

  triggerButton.addEventListener('click', () => {
    setStatus(statusNode, 'Preparing capture…', null);
    triggerButton.disabled = true;

    const responseTimeout = window.setTimeout(() => {
      triggerButton.disabled = false;
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
        triggerButton.disabled = false;

        if (chrome.runtime.lastError) {
          setStatus(
            statusNode,
            chrome.runtime.lastError.message || 'Capture could not start.',
            'error'
          );
          return;
        }

        if (!result?.ok) {
          setStatus(statusNode, result?.message ?? 'Capture failed.', 'error');
          return;
        }

        setStatus(statusNode, result.message, 'success');
      }
    );
  });
}

function setStatus(node: HTMLDivElement, value: string, variant: keyof typeof STATUS_CLASS | null): void {
  node.textContent = value;
  node.classList.remove(STATUS_CLASS.error, STATUS_CLASS.success);

  if (variant) {
    node.classList.add(STATUS_CLASS[variant]);
  }
}
