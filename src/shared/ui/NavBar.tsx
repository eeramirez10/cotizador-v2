import { Bell, Search } from "lucide-react";
import type { FC } from "react";
import { useMatches, type UIMatch } from "react-router";
import { useMediaQuery } from "../../hooks/useMediaQuery";

type TitleHandle = {
  title?: string | ((match: UIMatch) => string);
};

interface Props {
  handleOpen: () => void;
}

export const NavBar = () => {
  const matches = useMatches();
  const { handleOpenSideBar } = useMediaQuery();

  const deepestWithTitle = [...matches]
    .reverse()
    .find((match) => Boolean((match.handle as TitleHandle | undefined)?.title));

  const titleHandle = (deepestWithTitle?.handle ?? {}) as TitleHandle;

  const title =
    typeof titleHandle.title === "function"
      ? titleHandle.title(deepestWithTitle as UIMatch)
      : titleHandle.title ?? "-";

  return (
    <div className="flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white">
      <SideBarButton handleOpen={handleOpenSideBar} />

      <div className="m-2 flex-1">
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      </div>

      <div className="flex items-center space-x-4">
        <button>
          <Bell color="gray" />
        </button>

        <div className="relative">
          <input
            type="text"
            className="w-full rounded-md border border-gray-200 p-1 pl-10 pr-4"
            placeholder="Buscar ..."
          />
          <Search className="absolute left-3 top-1.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

const SideBarButton: FC<Props> = ({ handleOpen }) => {
  return (
    <button
      onClick={() => handleOpen()}
      className="ms-3 ml-4 mt-2 inline-flex items-center rounded-lg p-2 text-sm text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 md:hidden"
    >
      <span className="sr-only">Open sidebar</span>
      <svg className="h-6 w-6" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path
          clipRule="evenodd"
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
        ></path>
      </svg>
    </button>
  );
};
