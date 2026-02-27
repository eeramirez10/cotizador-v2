import { useEffect } from "react";
import { useUiStore } from "../store/ui/ui.store";

export const useMediaQuery = () => {
  const setOpen = useUiStore((state) => state.setOpen);
  const setClose = useUiStore((state) => state.setClose);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpen();
      } else {
        setClose();
      }
    };

    if (mediaQuery.matches) {
      setOpen();
    }

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [setClose, setOpen]);

  const handleOpenSideBar = () => {
    setOpen();
  };

  const handleCloseSideBaronClickNavItem = () => {
    setClose();
  };

  return {
    handleOpenSideBar,
    handleCloseSideBaronClickNavItem,
  };
};
