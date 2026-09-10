import { IconArchive, IconDotsVertical, IconUsers } from "@tabler/icons-react"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type Assignee,
} from "@crm/ui"
import { useDirectoryAssignees } from "@app/features/use-directory-data"

export function BookingOverflow({
  cancelled,
  onCancel,
}: {
  cancelled: boolean;
  onCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия бронирования"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconArchive aria-hidden="true" />
          {cancelled ? "Бронирование отменено" : "Отменить бронирование"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function BookingMobileActions({
  cancelled,
  onAssigneeChange,
  onCancel,
}: {
  cancelled: boolean;
  onAssigneeChange: (person: Assignee | null) => void;
  onCancel: () => void;
}) {
  const bookingAssignees = useDirectoryAssignees("booking");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия бронирования"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {bookingAssignees.map((person) => (
          <DropdownMenuItem
            key={person.id}
            onClick={() => onAssigneeChange(person)}
          >
            <IconUsers aria-hidden="true" />
            {person.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onAssigneeChange(null)}>
          <IconUsers aria-hidden="true" />
          Без ответственного
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconArchive aria-hidden="true" />
          {cancelled ? "Бронирование отменено" : "Отменить бронирование"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

