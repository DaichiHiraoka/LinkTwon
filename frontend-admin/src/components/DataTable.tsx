import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, FilterIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "./Icons";

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string;
};

export type RowAction<T> = {
  kind: "view" | "edit" | "delete";
  onClick: (row: T) => void;
  disabled?: (row: T) => boolean;
  label?: string;
};

type DataTableProps<T> = {
  title: ReactNode;
  titleIcon?: ReactNode;
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string | number;
  rowActions?: Array<RowAction<T>>;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  defaultSearch?: string;
  pageSize?: number;
  addCta?: { label: string; onClick: () => void };
  emptyMessage?: string;
  loading?: boolean;
};

const ACTION_LABEL = {
  view: "詳細",
  edit: "編集",
  delete: "削除",
};

const ACTION_ICON = {
  view: <EyeIcon size={16} />,
  edit: <PencilIcon size={16} />,
  delete: <TrashIcon size={16} />,
};

export function DataTable<T>({
  title,
  titleIcon,
  rows,
  columns,
  rowKey,
  rowActions = [],
  searchPlaceholder = "検索",
  onSearch,
  searchValue,
  defaultSearch = "",
  pageSize = 7,
  addCta,
  emptyMessage = "該当データがありません。",
  loading = false,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState(defaultSearch);
  const [page, setPage] = useState(1);
  const search = searchValue ?? internalSearch;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [rows, safePage, pageSize]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    onSearch?.(search);
    setPage(1);
  }

  return (
    <section className="datatable">
      <header className="datatable__header">
        <h1 className="datatable__title">
          {titleIcon ? <span className="datatable__title-icon">{titleIcon}</span> : null}
          {title}
        </h1>
      </header>
      <form className="datatable__toolbar" onSubmit={handleSearch}>
        <div className="datatable__search">
          <SearchIcon size={16} />
          <input
            type="text"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              if (onSearch) {
                onSearch(event.target.value);
              } else {
                setInternalSearch(event.target.value);
              }
            }}
          />
        </div>
        <button type="button" className="datatable__filter">
          <FilterIcon size={14} /> 絞り込む
        </button>
      </form>
      <div className="datatable__pager">
        <button
          type="button"
          className="datatable__pager-btn"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeftIcon size={14} /> 前へ
        </button>
        <span className="datatable__pager-current">{safePage}</span>
        <button
          type="button"
          className="datatable__pager-btn"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          次へ <ChevronRightIcon size={14} />
        </button>
      </div>
      <div className="datatable__table-wrap">
        <table className="datatable__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                  {column.label}
                </th>
              ))}
              {rowActions.length > 0 ? <th className="datatable__actions-head">管理</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="datatable__empty" colSpan={columns.length + (rowActions.length > 0 ? 1 : 0)}>
                  読み込み中…
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td className="datatable__empty" colSpan={columns.length + (rowActions.length > 0 ? 1 : 0)}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                  {rowActions.length > 0 ? (
                    <td className="datatable__row-actions">
                      {rowActions.map((action) => (
                        <button
                          key={action.kind}
                          type="button"
                          className={`row-action row-action--${action.kind}`}
                          onClick={() => action.onClick(row)}
                          aria-label={action.label ?? ACTION_LABEL[action.kind]}
                          title={action.label ?? ACTION_LABEL[action.kind]}
                          disabled={action.disabled?.(row)}
                        >
                          {ACTION_ICON[action.kind]}
                        </button>
                      ))}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {addCta ? (
        <div className="datatable__add-row">
          <button type="button" className="datatable__add-cta" onClick={addCta.onClick}>
            <PlusIcon size={16} /> {addCta.label}
          </button>
        </div>
      ) : null}
    </section>
  );
}
