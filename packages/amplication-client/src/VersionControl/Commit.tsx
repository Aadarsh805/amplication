import { Snackbar, TextField } from "@amplication/design-system";
import { gql, useMutation } from "@apollo/client";
import { Form, Formik } from "formik";
import { useCallback, useContext } from "react";
import { GlobalHotKeys } from "react-hotkeys";
import { useHistory } from "react-router-dom";
import { Button, EnumButtonStyle } from "../Components/Button";
import { AppContext } from "../context/appContext";
import { SortOrder, type Commit as CommitType } from "../models";
import { AnalyticsEventNames } from "../util/analytics-events.types";
import { formatError } from "../util/error";
import { CROSS_OS_CTRL_ENTER } from "../util/hotkeys";
import { commitPath } from "../util/paths";
import "./Commit.scss";
import { GET_COMMITS, GET_LAST_COMMIT } from "./hooks/commitQueries";

type TCommit = {
  message: string;
};

const INITIAL_VALUES: TCommit = {
  message: "",
};

type Props = {
  projectId: string;
  noChanges: boolean;
};
const CLASS_NAME = "commit";

const keyMap = {
  SUBMIT: CROSS_OS_CTRL_ENTER,
};

type TData = {
  commit: CommitType;
};

const Commit = ({ projectId, noChanges }: Props) => {
  const history = useHistory();
  const {
    setCommitRunning,
    resetPendingChanges,
    setPendingChangesError,
    addChange,
    currentWorkspace,
    currentProject,
  } = useContext(AppContext);
  const [commit, { error, loading }] = useMutation<TData>(COMMIT_CHANGES, {
    onError: () => {
      setCommitRunning(false);
      setPendingChangesError(true);
      resetPendingChanges();
    },
    onCompleted: (response) => {
      setCommitRunning(false);
      setPendingChangesError(false);
      resetPendingChanges();
      addChange(response.commit.id);
      const path = commitPath(
        currentWorkspace?.id,
        currentProject?.id,
        response.commit.id
      );
      return history.push(path);
    },
    refetchQueries: [
      {
        query: GET_LAST_COMMIT,
        variables: {
          projectId,
        },
      },
      {
        query: GET_COMMITS,
        variables: {
          projectId,
          orderBy: {
            createdAt: SortOrder.Desc,
          },
        },
      },
    ],
  });

  const handleSubmit = useCallback(
    (data, { resetForm }) => {
      setCommitRunning(true);
      commit({
        variables: {
          message: data.message,
          projectId,
        },
      }).catch(console.error);
      resetForm(INITIAL_VALUES);
      setPendingChangesError(false);
      resetPendingChanges();
    },
    [
      setCommitRunning,
      commit,
      projectId,
      setPendingChangesError,
      resetPendingChanges,
    ]
  );

  const errorMessage = formatError(error);

  return (
    <div className={CLASS_NAME}>
      <Formik
        initialValues={INITIAL_VALUES}
        onSubmit={handleSubmit}
        validateOnMount
      >
        {(formik) => {
          const handlers = {
            SUBMIT: formik.submitForm,
          };

          return (
            <Form>
              {!loading && (
                <GlobalHotKeys keyMap={keyMap} handlers={handlers} />
              )}
              <TextField
                rows={3}
                textarea
                name="message"
                label={noChanges ? "Build message" : "Commit message..."}
                disabled={loading}
                autoFocus
                hideLabel
                placeholder={noChanges ? "Build message" : "Commit message..."}
                autoComplete="off"
              />
              <Button
                type="submit"
                buttonStyle={EnumButtonStyle.Primary}
                eventData={{
                  eventName: AnalyticsEventNames.CommitCreate,
                }}
                disabled={loading}
              >
                {noChanges ? "Rebuild" : "Commit changes & build "}
              </Button>
            </Form>
          );
        }}
      </Formik>

      <Snackbar open={Boolean(error)} message={errorMessage} />
    </div>
  );
};

export default Commit;

const COMMIT_CHANGES = gql`
  mutation commit($message: String!, $projectId: String!) {
    commit(
      data: { message: $message, project: { connect: { id: $projectId } } }
    ) {
      id
    }
  }
`;
