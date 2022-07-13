/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
// eslint-disable-next-line import/no-unassigned-import
import "@hig/fonts/build/ArtifaktElement.css";
import Button from "@material-ui/core/Button";
import { createStyles, Theme, withStyles, WithStyles } from "@material-ui/core/styles";
import Skeleton from "react-loading-skeleton";

import classNames from "classnames";
import debounce from "lodash.debounce";
import * as React from "react";
import BaseTable from "react-base-table";
import { ModalConsumer } from "./ModalManager";
// eslint-disable-next-line import/no-unassigned-import
import "react-base-table/styles.css";
import { InspectorMessages, minRows } from "./constants";
import { EditReferencePath } from "./EditReferencePath";
import { computeIconSize, Empty } from "./Empty";
import { ExpiryModal } from "./ExpiryModal";
import { getDefaultInspectorTableIcons } from "./icons";
import { InspectorTableFooter } from "./InspectorTableFooter";
import { InspectorTableHeader } from "./InspectorTableHeader";
import {
  IColumns, IDataGetterParameter, IInspectorRow, IInspectorSearchCallback,
  IInspectorSearchMatch, IInspectorSearchMatchMap, IInspectorTableProps,
  IInspectorTableState,
} from "./InspectorTableTypes";
import {
  expandAll, fillExpanded, getReferenceValue, handleReferencePropertyEdit,
  IInspectorSearchControls, search, showNextResult, toTableRows,
} from "./utils";
import { ThemedSkeleton as themedSkeleton } from "./ThemedSkeleton";
import { NewDataForm } from "./NewDataForm";
import { NewDataRow } from "./NewDataRow";

// @TODO Figure out why SortOrder is not resolved as value after updating the table version
enum SortOrder{
  ASC = "asc",
  DSC = "dsc",
}

/**
 * @TODO -s
 * The idea is to decouple inspector app from property-dds and allow viewing
 * and eventually editing other sources of data in form ES6 proxy.
 *
 * To allow this we will need to change the component API as follows:
 *
 * 1- Allow user to pass custom `toRowData` function through props, this is a transformation function from
 * data source X -> IInspectorRowData.
 *
 * 2- Column renderers should be passed through props.
 *
* 3-
 */
const defaultSort = { key: "name", order: SortOrder.ASC };

const footerHeight = 32;

const styles = (theme: Theme) => createStyles({
  currentMatch: {
    backgroundColor: "rgba(250,162,27,0.5)",
    display: "flex",
    width: "100%",
  },
  dataForm: {
    height: "100%",
    width: "100%",
  },
  dataFormContainer: {
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    height: "100%",
  },
  editReference: {
    flexBasis: "60%",
    marginBottom: theme.spacing(1),
    maxWidth: "600px",
    zIndex: 200,
  },
  editReferenceContainer: {
    bottom: footerHeight,
    display: "flex",
    justifyContent: "center",
    position: "absolute",
    width: "100%",
  },
  evenRow: {
    backgroundColor: "#FFFFFF",
    color: "#3c3c3c",
  },
  expiredNotice: {
    display: "flex",
    flexDirection: "column",
  },
  expiryButton: {
    alignSelf: "center",
    marginTop: "16px",
  },
  header: {
    "background-color": "#FFFFFF",
    "color": "#3c3c3c",
    "font-size": "12px",
    "font-weight": "700",
    "text-transform": "none",
  },
  isConstFlag: {
    color: "#3C3C3C",
    display: "flex",
    fontFamily: "ArtifaktElement, Helvetica, Arial",
    fontSize: "11px",
    fontStyle: "normal",
    fontWeight: "normal",
    justifyContent: "flex-end",
    lineHeight: "20px",
    marginLeft: "auto",
    marginRight: "5px",
    minWidth: "97.5px",
  },
  match: {
    backgroundColor: "rgba(250,162,27,0.2)",
    display: "flex",
    width: "100%",
  },
  oddRow: {
    backgroundColor: "#F9F9F9",
    color: "#3c3c3c",
  },
  root: {
    "font-family": "ArtifaktElement, Helvetica, Arial",
    "font-size": "14px",
  },
  row: {
    "&:hover, &.NameCell__hovered": {
      backgroundColor: "rgb(243,243,243)",
    },
    "border": "0",
  },
  searchBoxContainer: {
    height: "70%",
    marginLeft: "auto",
    marginRight: "auto",
    width: "50%",
  },
  skeletonLoading: {
    paddingRight: "15px",
  },
  table: {
    boxShadow: "none",
  },
  tooltip: {
    backgroundColor: "black",
  },
  typeIdRow: {
    display: "flex",
    flexBasis: "100%",
    flexWrap: "nowrap",
    height: "100%",
    justifyContent: "space-between",
    minWidth: 0,
  },
  typeIdRowLeft: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/**
 * @param width - width of the table
 * @returns random width which fits half of the table
 */
const getRandomRowsNum = () => {
  return Math.floor(Math.random() * minRows + minRows);
};

/**
 * The default implementation for the InspectorTable `childGetter` callback.
 * @param child - The hierarchical child of the property the row represents.
 * @returns The passed in child.
 */
export const defaultInspectorTableChildGetter = (child: any): any => child;

/**
 * The default implementation for the InspectorTable `nameGetter` callback.
 * @param name - The id of the property the row represents.
 * @returns The passed in id.
 */
export const defaultInspectorTableNameGetter = (name: string): any => name;

/**
 * The default implementation of the `dataGetter` callback for the Inspector table
 * @param params - function handle
 */
export const defaultInspectorTableDataGetter = (params: IDataGetterParameter): React.ReactNode | null => null;

/**
 * A component for inspecting the workspace data. It supports displaying the name, context, typeid and value of
 * the data. How many columns and in which order these are shown is configurable by the user via the 'column' prop.
 * @hidden
 */
class InspectorTable<T = unknown> extends React.Component<WithStyles<typeof styles> & IInspectorTableProps,
  IInspectorTableState> {
  public static defaultProps: Partial<IInspectorTableProps> = {
    childGetter: defaultInspectorTableChildGetter,
    expandColumnKey: "name",
    followReferences: true,
    nameGetter: defaultInspectorTableNameGetter,
    rowHeight: 32,
    rowIconRenderer: getDefaultInspectorTableIcons,
    editReferenceHandler: handleReferencePropertyEdit,
    toTableRows,
  };

  public static getDerivedStateFromProps(
    props: IInspectorTableProps,
    state: IInspectorTableState,
  ): Partial<IInspectorTableState> {
    let newState: Partial<IInspectorTableState> = {};
    if (props.checkoutInProgress) {
      newState = { editReferenceRowData: null };
    }
    if (props.activeRepositoryGuid !== state.expandedRepoGuid) {
      return {
        ...newState,
        expanded: props.activeRepositoryGuid && props.activeRepositoryGuid in state.expandedRepoMap ?
          { ...state.expandedRepoMap[props.activeRepositoryGuid] } : {},
        expandedRepoGuid: props.activeRepositoryGuid,
        expandedRepoMap: state.expandedRepoGuid ?
          { ...state.expandedRepoMap, [state.expandedRepoGuid]: { ...state.expanded } } : { ...state.expandedRepoMap },
      };
    }
    return newState;
  }

  public state: IInspectorTableState = {
    childToParentMap: {},
    commitHistoryVisible: false,
    currentResult: -1,
    editReferenceRowData: null,
    expanded: {},
    expandedRepoGuid: "",
    expandedRepoMap: {},
    foundMatches: [],
    matchesMap: {},
    searchDone: false,
    searchExpression: "",
    searchInProgress: false,
    showFormRowID: "0",
    sortBy: defaultSort,
    tableRows: [],
  };
  
  private readonly dataCreation: boolean;
  private columns: any;
  private readonly debouncedSearchChange: (searchExpression: string) => void;
  private readonly table = React.createRef();
  private toTableRowOptions;

  public constructor(props) {
    super(props);
    const { followReferences } = props;
    this.dataCreation = !!this.props.dataCreationHandler && !!this.props.dataCreationOptionGenerationHandler;
    this.columns = this.generateColumns(props.width);
    this.toTableRowOptions = {
      addDummy: true, ascending: defaultSort.order === SortOrder.ASC,
      depth: 0, followReferences,
    };

    this.debouncedSearchChange = debounce((searchExpression: string) => {
      const newState: Pick<IInspectorTableState, "currentResult" | "foundMatches" | "matchesMap" |
        "searchAbortHandler" | "searchInProgress" | "searchState" | "childToParentMap" | "searchDone"> = {
        childToParentMap: {}, currentResult: undefined, foundMatches: [], matchesMap: {},
        searchAbortHandler: undefined, searchDone: false, searchInProgress: false, searchState: undefined,
      };

      // If a search process was running already, stop it.
      if (this.state.searchAbortHandler) {
        this.state.searchAbortHandler();
      }

      let forceUpdate = false;
      if (this.state.foundMatches.length > 0) {
        forceUpdate = true;
      }

      if (searchExpression.length > 0) {
        // Trigger a new search process.
        const searchControls = this.startSearch(searchExpression, this.updateSearchState, false);
        newState.searchAbortHandler = searchControls ? searchControls.abortHandler : undefined;
        newState.searchState = searchControls ? searchControls.state : undefined;
        newState.currentResult = -1;
        newState.searchInProgress = true;
        newState.searchDone = false;
      }

      // Set the initial state for a fresh search.
      this.setState(newState, () => {
        if (forceUpdate) {
          this.forceUpdateBaseTable();
        }
      });
    }, 250);
  }

  public componentDidMount() {
    const { data } = this.props;
    const { expanded } = this.state;
    if (data) {
      const updatedTableRows = this.props.toTableRows!({ data, id: "" }, this.props, this.toTableRowOptions);
      fillExpanded(expanded, updatedTableRows, this.props,
        this.toTableRowOptions);
      this.setState({ tableRows: updatedTableRows });
    }
  }

  public componentDidUpdate(prevProps, prevState) {
    const { data, checkoutInProgress, followReferences } = this.props;
    const { currentResult, expanded, tableRows, searchExpression, sortBy } = this.state;
    let { foundMatches, childToParentMap } = this.state;
    this.toTableRowOptions.followReferences = followReferences;
    const newState = {} as Pick<IInspectorTableState, "currentResult" | "expanded" | "foundMatches" | "matchesMap" |
      "searchAbortHandler" | "searchDone" | "searchInProgress" | "searchState" | "tableRows" | "childToParentMap">;
    let forceUpdateRequired = false;

    // Cancel all search activity and clear the search field when checking out a new repo.
    if (checkoutInProgress && searchExpression.length > 0) {
      this.handleOnClear();
    }

    // We need to keep search data up to date with the current data.
    // TODO: We cannot check if props.data changed, which is why we check props in general.
    // This has the undesired side effect that we also restart search when the browser window is resized, for example.
    if ((prevProps !== this.props || prevState.sortBy.order !== sortBy.order) && !checkoutInProgress) {
      if (data) {
        const updatedTableRows = this.props.toTableRows!({ data, id: "" }, this.props,
          this.toTableRowOptions);
        fillExpanded(expanded, updatedTableRows, this.props, this.toTableRowOptions);
        // We need to update the table rows directly, because they might be used in the search call below.
        // Treating table rows as a mutable state property is fine, since it is purely derived from props anyway, and
        // we also update it directly in other places already.
        this.state.tableRows = updatedTableRows;
        // We still need to add it to the new state to trigger a re-render of the table.
        newState.tableRows = updatedTableRows;
      }

      if (searchExpression.length > 0) {
        // If a search process was running already, stop it.
        if (this.state.searchAbortHandler) {
          this.state.searchAbortHandler();
        }

        // Trigger the new search and update the state.
        const searchControls = this.startSearch(searchExpression, this.updateSearchState, false);
        newState.searchAbortHandler = searchControls ? searchControls.abortHandler : undefined;
        newState.searchState = searchControls ? searchControls.state : undefined;
        newState.searchDone = false;
        newState.searchInProgress = true;
        newState.currentResult = -1;
        newState.foundMatches = [];
        newState.matchesMap = {};
        newState.childToParentMap = {};

        foundMatches = [];
        childToParentMap = {};
        forceUpdateRequired = true;
      }
    }

    // Scroll the table to the current search result.
    // TODO: As above, we should check for changes in props.data rather than just props.
    let scrollingRequired = false;
    let toExpand;
    if (searchExpression.length > 0 && foundMatches.length > 0 && !checkoutInProgress &&
      prevState.currentResult !== currentResult) {
      // need to update expanded according to the new currentResult
      toExpand = showNextResult(tableRows, expanded, foundMatches, currentResult!, childToParentMap);
      newState.expanded = toExpand.expandedRows;
      forceUpdateRequired = true;
      scrollingRequired = true;
    }

    // Update the state if necessary, and also scroll and/or force update the base table when required.
    if (Object.keys(newState).length > 0) {
      this.setState(newState, () => {
        if (forceUpdateRequired) {
          this.forceUpdateBaseTable();
        }
        if (scrollingRequired) {
          (this.table.current as any).scrollToRow(toExpand.rowIdx);
        }
      });
    }
  }

  public render() {
    const {
      childGetter,
      classes,
      columns,
      currentUrn,
      data,
      deleteRepo,
      expired,
      followReferences,
      getRepoExpiry,
      height,
      isV1Urn,
      nameGetter,
      repositoryUrn,
      rowIconRenderer,
      searchBoxProps,
      setRepoExpiry,
      width,
      activeRepositoryGuid,
      ...restProps } = this.props;

    const {
      searchExpression,
      expanded,
      sortBy,
      currentResult,
      foundMatches,
      searchInProgress,
      editReferenceRowData,
    } = this.state;

    let rows = this.state.tableRows;

    let expandedKeys: string[] = [];
    let emptyDescription: string;
    if (data !== undefined) {
      // const property = data.getProperty();
      // const workspace = property.getRoot().getWorkspace();
      // if (workspace) {
        expandedKeys = Object.keys(expanded);
        emptyDescription = InspectorMessages.EMPTY_WORKSPACE;
      // } else {
      //   emptyDescription = InspectorMessages.NO_WORKSPACE;
      // }
    } else {
      rows = [];
      emptyDescription = InspectorMessages.NO_DATA;
    }
    // Set up the animation data in case we are currently checking out
    const circleSkeleton = (
      <div className={this.props.classes.skeletonLoading}>
        <Skeleton circle={true} height={14} width={14} />
      </div>
    );
    const skeletonExpandIcon = ({ ...rest }) =>
      Object.keys(rest).length === 0 ? null : themedSkeleton(circleSkeleton);
    const components = this.props.checkoutInProgress ? { ExpandIcon: skeletonExpandIcon } : {};
    const fakeRows = Array.from(Array(getRandomRowsNum()), (x, i) => ({ id: i.toString() }));
    const rowsData = this.props.checkoutInProgress ? fakeRows : rows;
    this.columns = this.generateColumns(width);
    const getHeader = ({ cells, headerIndex }) => {
      if (headerIndex === 1) {
        return cells;
      }
      return (
        <InspectorTableHeader
          searchBoxProps={{
            currentResult,
            onChange: this.handleSearchExpressionChange,
            onClear: this.handleOnClear,
            onNext: this.handleCurrentResultChange,
            onPrevious: this.handleCurrentResultChange,
            searchExpression,
            searchInProgress,
            totalResults: foundMatches.length,
            ...searchBoxProps,
          }}
        />
      );
    };

    const getEmptyPanel = (repoIsExpired: boolean = false) => {
      const modalEnabled = !!repositoryUrn && !!currentUrn && !isV1Urn;
      if (repoIsExpired) {
        return (
          <Empty
            description={
              <div className={classes.expiredNotice}>
                <span>
                  Expired repositories are destroyed after 30 days.<br />
                  Until they get destroyed, expired repositories can be restored.
                  {
                    !modalEnabled &&
                    <span>
                      <br /><br />Undeleting expired repositories is only possible with v2 urns.<br />
                      Please change your v1 urn ({this.props.currentUrn}) into a v2 urn manually and reload.
                    </span>
                  }
                </span>
                <ModalConsumer>
                  {({ showModal, hideModal }) => (
                    <Button
                      className={classes.expiryButton}
                      color="primary"
                      disabled={!modalEnabled}
                      variant="contained"
                      onClick={
                        () => {
                          const modalProps = {
                            deleteRepo: deleteRepo!,
                            getRepoExpiry: getRepoExpiry!,
                            isV1Urn: isV1Urn!,
                            onClosed: hideModal,
                            repositoryUrn: repositoryUrn!,
                            setRepoExpiry: setRepoExpiry!,
                          };
                          showModal(ExpiryModal, modalProps);
                        }
                      }
                    >
                      Manage Repository Expiry
                    </Button>
                  )}
                </ModalConsumer>
              </div>}
            iconId={"expired"}
            iconSize={computeIconSize(width)}
            message={"This repository is expired"}
          />
        );
      } else {
        return (
          <Empty
            description={emptyDescription}
            iconId={"no-data"}
            iconSize={computeIconSize(width)}
            message={"There is no data to show"}
          />
        );
      }
    };

    return (
      <div className={classes.root}>
        <BaseTable<T>
          // ref={this.table}
          data={rowsData}
          width={width}
          className={classes.table}
          headerHeight={[36, 36]}
          headerClassName={classes.header}
          headerRenderer={getHeader}
          rowClassName={({ rowIndex }) => classNames(classes.row,
            (rowIndex % 2 === 0) ? classes.evenRow : classes.oddRow)}
          gridStyle={{ outline: "none" }}
          onRowExpand={this.handleRowExpanded}
          expandedRowKeys={expandedKeys}
          height={height}
          {...restProps}
          columns={this.columns}
          onColumnSort={this.onColumnSort}
          sortBy={sortBy}
          footerHeight={32}
          footerRenderer={this.footerRenderer}
          emptyRenderer={getEmptyPanel(!!expired)}
          components={components}
        />
        {
          editReferenceRowData &&
          <div style={{ position: "relative", width }}>
            <div className={classes.editReferenceContainer}>
              <EditReferencePath
                className={classes.editReference}
                name={editReferenceRowData.name}
                path={getReferenceValue(editReferenceRowData)}
                onCancel={this.handleCancelEditReference}
                onEdit={this.handleEditReference}
              />
            </div>
          </div>
        }
      </div>
    );
  }

  private readonly generateColumns = (width: number) => {
    const columns: IColumns[] = [];
    width = width / this.props.columns.length;
    for (const currentId of this.props.columns) {
      const newColumn: IColumns = {
        dataGetter: this.props.dataGetter,
        dataKey: currentId,
        key: currentId,
        resizable: true,
        sortable: currentId === "name",
        title: currentId[0].toUpperCase() + currentId.slice(1), // Capitalize title
        width,
      };
      newColumn.cellRenderer = this.props.columnsRenderers ? this.props.columnsRenderers[currentId] : undefined;
      columns.push(newColumn);
    }
    return columns;
  };

  private readonly handleInitialEditReference = (rowData: IInspectorRow) => {
    this.setState({ editReferenceRowData: rowData });
  };

  private readonly handleCancelEditReference = () => {
    this.setState({ editReferenceRowData: null });
  };

  private readonly handleEditReference = async (newPath: string) => {
    const rowData = this.state.editReferenceRowData!;
    return this.props.editReferenceHandler!(rowData, newPath).finally(() => {
      this.removeIdFromExpanded(rowData.id);
      this.handleCancelEditReference();
    });
  };

  private readonly handleOnClear = () => {
    if (this.state.searchAbortHandler) {
      this.state.searchAbortHandler();
    }
    this.setState({
      currentResult: undefined, foundMatches: [], matchesMap: {}, searchAbortHandler: undefined,
      searchDone: false, searchExpression: "", searchInProgress: false, searchState: undefined,
    });
    this.forceUpdateBaseTable();
  };

  private readonly handleCurrentResultChange = (newResult: number) => {
    if (this.state.currentResult !== undefined &&
      this.state.currentResult < newResult &&
      this.state.currentResult === this.state.foundMatches.length - 1 &&
      !this.state.searchDone) {
      this.continueSearchOnDemand();
    } else if (this.state.searchDone && this.state.currentResult === this.state.foundMatches.length - 1) {
      this.setState({ currentResult: 0 });
    } else {
      this.setState({ currentResult: newResult });
    }
  };

  private readonly continueSearchOnDemand = () => {
    const newState: Pick<IInspectorTableState, "searchAbortHandler" | "searchInProgress" | "searchState"> = {
      searchInProgress: true,
    };
    const { searchExpression } = this.state;
    const searchControls = this.startSearch(searchExpression, this.updateSearchState);
    if (searchControls) {
      newState.searchAbortHandler = searchControls.abortHandler;
      newState.searchState = searchControls.state;
      this.setState(newState);
    }
  };

  private readonly startSearch = (
    searchExpression: string,
    callback: IInspectorSearchCallback,
    keepMatches = true,
  ): IInspectorSearchControls | undefined => {
    const { data } = this.props;
    const { searchState, tableRows } = this.state;
    const currentWorkspace = data;
    if (currentWorkspace) {
      const searchControls = search(searchExpression, tableRows, this.props.dataGetter,
        this.columns, callback, this.props,
        this.toTableRowOptions,
        keepMatches ? searchState : undefined);
      return searchControls;
    } else {
      return undefined;
    }
  };

  private readonly handleSearchExpressionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchExpression = event.target.value;
    this.debouncedSearchChange(searchExpression);
    this.setState({ searchExpression });
  };

  private readonly footerRenderer = () => {
    return (
      <InspectorTableFooter
        handleCollapseAll={this.handleCollapseAll}
        handleExpandAll={this.handleExpandAll}
        parentProps={this.props}
      />
    );
  };

  private readonly removeIdFromExpanded = (id: string) => {
    const newExpanded = { ...this.state.expanded };
    delete newExpanded[id];
    this.setState({ expanded: newExpanded });
  };

  // @TODO: Add tests.
  private traverseTree(item: IInspectorRow, func: (item: IInspectorRow) => any) {
    if (item) {
      func(item);
      const tableRows = item.children;
      if (tableRows) {
        tableRows.forEach((row) => {
          this.traverseTree(row, func);
        });
      }
    }
  }

  // @TODO: Add tests.
  private readonly handleExpandAll = (props) => {
    if (props.data.getProperty) {
      const workspace = props.data.getProperty().getRoot().getWorkspace();
      const output = expandAll(workspace);

      const tableRows = this.state.tableRows;
      tableRows.forEach((item) => {
        this.traverseTree(item, (item) => {
          if (item.children && !item.isReference) {
            if (item.children[0].context === "d") {
              fillExpanded({ [item.id]: true }, [item], this.props, this.toTableRowOptions);
            }
          }
        });
      });

      this.setState({
        expanded: output,
      });
    }
  };

  private readonly handleInitiateCreate(rowData: IInspectorRow) {
    this.setState({ showFormRowID: rowData.id });
    this.forceUpdateBaseTable();
  }

  private async handleCreateData(rowData: IInspectorRow, name: string, type: string, context: string) {
    if (this.dataCreation) {
      this.props.dataCreationHandler!(rowData, name, type, context);
      this.setState({ showFormRowID: "0" });
      this.forceUpdateBaseTable();
    }
  }

  private readonly handleCancelCreate = () => {
    this.setState({ showFormRowID: "0" });
    this.forceUpdateBaseTable();
  };

  private readonly renderCreationRow = (rowData: IInspectorRow) => {
    const { dataCreationOptionGenerationHandler, handleInitiateCreate, generateForm, classes } = this.props;
    const result = dataCreationOptionGenerationHandler!(rowData, true);

    const addDataRow = (
      <NewDataRow
        dataType={result.name}
        onClick={handleInitiateCreate.bind(this, rowData)}
      />
    );

    const addDataForm = (options) => (
      <div className={classes.dataForm}>
        <NewDataForm
          onCancelCreate={handleCancelCreate}
          onDataCreate={handleCreateData.bind(this, rowData)}
          options={options}
          rowData={rowData}
        />
      </div>
    );

    return (
      <div className={classes.dataFormContainer}>
        {
          this.state.showFormRowID === rowData.id ?
            generateForm.call(this, rowData) &&
            addDataForm(this.props.dataCreationOptionGenerationHandler!(rowData, false).options) :
            addDataRow
        }
      </div>
    );
  };

  private readonly handleCollapseAll = () => {
    this.setState({ expanded: {} });
  };

  /**
   * Maps the expanded row to either the filteredExpanded list or the whole dataset expanded list. This
   * allows the user to come back to the state before performing the filtering
   */
  // eslint-disable-next-line max-len
  private readonly handleRowExpanded = ({ expanded: newExpandedFlag, rowData }: { expanded: boolean; rowData: IInspectorRow; }) => {
    const newExpanded = { ...this.state.expanded };
    const idInExpanded = rowData.id in newExpanded;
    if (newExpandedFlag && !idInExpanded) {
      newExpanded[rowData.id] = true;
      if (rowData.children && rowData.children![0].id === "d") {
        fillExpanded(newExpanded, this.state.tableRows, this.props, this.toTableRowOptions);
      }
    } else if (!newExpandedFlag && idInExpanded) {
      delete newExpanded[rowData.id];
    }
    this.setState({ expanded: newExpanded });
  };
  private readonly onColumnSort = (sortBy) => {
    this.setState({
      sortBy,
    });
  };

  private readonly updateSearchState = (foundMatches: IInspectorSearchMatch[], matchesMap: IInspectorSearchMatchMap,
    done: boolean, childToParentMap: { [key: string]: string; }) => {
    const newState = {} as Pick<IInspectorTableState, "currentResult" | "foundMatches" | "matchesMap" |
      "searchInProgress" | "searchAbortHandler" | "searchExpression" | "childToParentMap" | "searchDone" |
      "searchState">;

    newState.searchInProgress = false;
    if ((this.state.currentResult === -1 || this.state.currentResult === undefined) && foundMatches.length > 0) {
      newState.currentResult = 0;
    }
    if (this.state.foundMatches.length < foundMatches.length) {
      newState.foundMatches = foundMatches.slice();
      newState.matchesMap = { ...matchesMap };
      newState.childToParentMap = { ...childToParentMap };
      newState.currentResult = foundMatches.length - 1;
    } else if (done && foundMatches.length > 0) {
      newState.currentResult = 0;
    }
    if (done) {
      newState.searchAbortHandler = undefined;
      newState.searchDone = true;
      newState.searchState = undefined;
    }
    this.setState(newState);
  };

  private readonly forceUpdateBaseTable = () => {
    (this.table.current as any).table.bodyRef.recomputeGridSize();
  };
}

const StyledInspectorTable = withStyles(styles, { name: "InspectorTable" })(InspectorTable as any);
export { StyledInspectorTable as InspectorTable };
