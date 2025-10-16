import FileList from './FileList';

const Dashboard: React.FC<{ organizationId: string }> = ({ organizationId }) => {

  return (
    <div className="dashboard">
      <FileList organizationId={organizationId} />
    </div>
  );
};

export default Dashboard;
