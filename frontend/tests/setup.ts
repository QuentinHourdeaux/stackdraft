import "@testing-library/jest-dom/vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const nativeShowModal = HTMLDialogElement.prototype.showModal;
const nativeClose = HTMLDialogElement.prototype.close;

HTMLDialogElement.prototype.showModal = function showModal() {
  if (this.open) {
    throw new DOMException(
      "Failed to execute 'showModal' on 'HTMLDialogElement': The element is already open.",
      "InvalidStateError",
    );
  }

  if (nativeShowModal) {
    nativeShowModal.call(this);
    return;
  }

  this.setAttribute("open", "");
};

HTMLDialogElement.prototype.close = function close(returnValue?: string) {
  if (nativeClose) {
    nativeClose.call(this, returnValue);
    return;
  }

  this.removeAttribute("open");
};
