import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";

interface JobRow {
  id: string;
  title: string;
  department: string;
  manager_id: string | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string;
  work_type: string;
  applications_count: number;
  status: string;
  created_at: string;
}

interface Props {
  jobs: JobRow[];
  managers: { id: string; full_name: string }[];
  onPostJob: () => void;
}

const HRJobsView = ({ jobs, managers, onPostJob }: Props) => {
  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "—";
    return managers.find((m) => m.id === managerId)?.full_name || "—";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Posted Jobs ({jobs.length})</h2>
        <Button onClick={onPostJob} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Post New Job
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Job Title</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Salary</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Applications</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date Posted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                No jobs posted yet. Click &quot;Post New Job&quot; to get started.
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell>{job.department}</TableCell>
                <TableCell>{getManagerName(job.manager_id)}</TableCell>
                <TableCell>
                  {job.salary_min && job.salary_max
                    ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`
                    : "—"}
                </TableCell>
                <TableCell>{job.location}</TableCell>
                <TableCell>{job.applications_count}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(job.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </motion.div>
  );
};

export default HRJobsView;
