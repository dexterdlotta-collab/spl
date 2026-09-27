grant delete on public.subjects to authenticated;

drop policy if exists "Creators can delete their subjects" on public.subjects;
create policy "Creators can delete their subjects"
on public.subjects
for delete
to authenticated
using (created_by = auth.uid());