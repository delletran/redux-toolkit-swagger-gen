type IValue = string | number
type RCE<T> = React.ChangeEvent<T>
type RME<T> = React.MouseEvent<T>

type ItemActionProps<T = unknown> = {
  onEdit?: (arg: T) => void
  onDelete?: (arg: T) => void
  onView?: (arg: T) => void
  disabled?: boolean
}
