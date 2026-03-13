import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const NotificationCenter = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3500}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
    />
  );
};
