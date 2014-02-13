(defun emacs-format-function ()

  (package-initialize)
  (js2-mode)
  (setq js2-basic-offset 2)
  (indent-region (point-min) (point-max) nil)
  (save-buffer)
)
